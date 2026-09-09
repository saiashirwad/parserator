/**
 * The input-agnostic parser engine. Text, bytes, and bits each instantiate it
 * once with an adapter that knows how to read and report on their input.
 */
import type { Diagnostic, Failure, Span } from "./errors.ts"

export type CoreState<I> = {
  readonly source: I
  readonly offset: number
  readonly cutGeneration: number
  /** Context from the last parser wrapped in `context`, used by full-input parsing. */
  readonly completionContext?: readonly string[]
}

export type Success<T> = { readonly ok: true; readonly value: T }
export type FailureResult = { readonly ok: false; readonly failure: Failure }
export type CoreReply<T, I> = {
  readonly state: CoreState<I>
  readonly result: Success<T> | FailureResult
}

/** Pair a parser result with its resulting state without altering either. */
export const makeReply = <T, I>(
  state: CoreState<I>,
  result: Success<T> | FailureResult
): CoreReply<T, I> => ({ state, result })

/** Start parsing at an offset with no active commit or completion context. */
export const initialState = <I>(source: I, offset = 0): CoreState<I> => ({
  source,
  offset,
  cutGeneration: 0
})

/** The same state at a new offset, without copying an absent completion context. */
export const advanceTo = <I>(
  state: CoreState<I>,
  offset: number
): CoreState<I> => ({
  source: state.source,
  offset,
  cutGeneration: state.cutGeneration,
  ...(state.completionContext
    ? { completionContext: state.completionContext }
    : {})
})

export type CoreParseResult<T, E extends Error> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: E }
export type CorePrefixResult<T, I> = {
  readonly value: T
  readonly offset: number
  readonly rest: I
}

/** The object a `struct` produces: one property per field parser, in order. */
export type StructValue<Fields> = {
  -readonly [K in keyof Fields]: Fields[K] extends CoreParser<infer T, any, any>
    ? T
    : never
}

/** Offsets and spans are measured in the input adapter's units. */
export interface CoreParser<T, I, E extends Error> {
  /** The parsed value's type, for `typeof p.Type`. Absent at runtime. */
  readonly Type: T
  map<B>(f: (value: T) => B): CoreParser<B, I, E>
  flatMap<B>(f: (value: T) => CoreParser<B, I, E>): CoreParser<B, I, E>
  zip<B>(other: CoreParser<B, I, E>): CoreParser<[T, B], I, E>
  zipRight<B>(other: CoreParser<B, I, E>): CoreParser<B, I, E>
  zipLeft<B>(other: CoreParser<B, I, E>): CoreParser<T, I, E>
  [Symbol.iterator](): Generator<CoreParser<T, I, E>, T, any>
  expected(description: string): CoreParser<T, I, E>
  context(description: string): CoreParser<T, I, E>
  withSpan<B>(f: (value: T, span: Span) => B): CoreParser<B, I, E>
  validate(
    predicate: (value: T) => boolean | string,
    message?: string
  ): CoreParser<T, I, E>
  trim(trivia: CoreParser<unknown, I, E>): CoreParser<T, I, E>
  trimLeft(trivia: CoreParser<unknown, I, E>): CoreParser<T, I, E>
  trimRight(trivia: CoreParser<unknown, I, E>): CoreParser<T, I, E>
  commit(): CoreParser<T, I, E>
  parse(
    input: I,
    options?: { readonly sourceName?: string }
  ): CoreParseResult<T, E>
  parsePrefix(
    input: I,
    options?: { readonly sourceName?: string }
  ): CoreParseResult<CorePrefixResult<T, I>, E>
  parseOrThrow(input: I, options?: { readonly sourceName?: string }): T
}

export interface InputAdapter<I, E extends Error> {
  fromInput(input: I): CoreState<I>
  isAtEnd(state: CoreState<I>): boolean
  remaining(state: CoreState<I>): I
  /** The unit at the cursor, for "found" reporting; empty with width 0 at the end. */
  peek(state: CoreState<I>): { readonly value: string; readonly width: number }
  /** Orders competing failures; the furthest one is reported. */
  failureOffset(diagnostic: Diagnostic): number
  error(diagnostic: Diagnostic, input: I, sourceName?: string): E
}

/** Reject negative, fractional, or unsafe counts before constructing a parser. */
export function ensureCount(n: number): void {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError("count must be a safe nonnegative integer")
}

/** Measure diagnostic nesting to break ties between failures at one position. */
function contextSize(diagnostic: Diagnostic): number {
  return diagnostic.context?.length ?? 0
}

/** Select the failure with the deepest context from a nonempty list. */
function mostSpecific(failures: readonly Failure[]): Failure {
  return failures.reduce((best, candidate) =>
    contextSize(candidate.diagnostic) > contextSize(best.diagnostic)
      ? candidate
      : best
  )
}

/** Report the furthest failures, preferring custom messages and merging expectations. */
function mergeFailures(
  failures: readonly [Failure, ...Failure[]],
  position: (diagnostic: Diagnostic) => number
): Failure {
  let furthest = -Infinity
  let atFurthest: Failure[] = []
  for (const failure of failures) {
    const at = position(failure.diagnostic)
    if (at > furthest) {
      furthest = at
      atFurthest = [failure]
    } else if (at === furthest) atFurthest.push(failure)
  }
  const custom = atFurthest.filter(
    failure =>
      failure.diagnostic.kind === "custom" ||
      failure.diagnostic.message !== undefined
  )
  const expectedFailures = atFurthest.filter(
    failure => failure.diagnostic.kind === "expected"
  )
  const base = mostSpecific(
    custom.length
      ? custom
      : expectedFailures.length
        ? expectedFailures
        : atFurthest
  )
  let diagnostic = base.diagnostic

  if (!custom.length && expectedFailures.length) {
    const items = [
      ...new Set(
        expectedFailures.flatMap(failure => failure.diagnostic.expected ?? [])
      )
    ]
    diagnostic = {
      ...base.diagnostic,
      kind: "expected",
      span: {
        start: base.diagnostic.span.start,
        end: Math.max(
          base.diagnostic.span.start,
          ...expectedFailures.map(failure => failure.diagnostic.span.end)
        )
      },
      expected: items
    }
  }

  return {
    diagnostic,
    control: {
      kind: "recoverable",
      cutGeneration: Math.max(
        ...atFurthest.map(failure =>
          failure.control.kind === "recoverable"
            ? failure.control.cutGeneration
            : 0
        )
      )
    }
  }
}

/** One engine per input kind also rejects mixed parsers at runtime. */
export function createParserEngine<I, E extends Error>(
  adapter: InputAdapter<I, E>
) {
  type Parser<T> = CoreParser<T, I, E>
  type State = CoreState<I>
  type Reply<T> = CoreReply<T, I>
  type ParseResult<T> = CoreParseResult<T, E>
  type PrefixParseResult<T> = CoreParseResult<CorePrefixResult<T, I>, E>
  type Runner<T> = (state: State) => Reply<T>

  const runners = new WeakMap<object, Runner<unknown>>()
  const parserToken = Symbol("Parser")

  /** Remove context inherited from an earlier successful parser. */
  function clearCompletionContext(state: State): State {
    if (!state.completionContext) return state
    const { completionContext: _completionContext, ...rest } = state
    return rest
  }

  /** Return a value and clear the previous completion context. */
  const replySuccess = <T>(value: T, state: State): Reply<T> =>
    makeReply(clearCompletionContext(state), { ok: true, value })

  /** Return a failure while preserving its diagnostic, control state, and cursor. */
  const failRich = (failure: Failure, state: State): Reply<never> =>
    makeReply(state, { ok: false, failure })

  /** Attach a diagnostic to the current state with recoverable or fatal control. */
  const failureAt = (
    state: State,
    diagnostic: Diagnostic,
    fatal = false
  ): Reply<never> =>
    failRich(
      {
        diagnostic,
        control: fatal
          ? { kind: "fatal" }
          : { kind: "recoverable", cutGeneration: state.cutGeneration }
      },
      state
    )

  /** Describe the expected item and the input unit at the cursor. */
  const expectedDiagnostic = (state: State, item: string): Diagnostic => {
    const { value: found, width } = adapter.peek(state)
    return {
      kind: "expected",
      span: { start: state.offset, end: state.offset + width },
      expected: [item],
      ...(found ? { found } : {})
    }
  }

  /** Fail at the cursor with an expected-item diagnostic. */
  const expected = (state: State, item: string): Reply<never> =>
    failureAt(state, expectedDiagnostic(state, item))

  /** True when a failure must propagate: fatal, or committed past `generation`. */
  const escapes = (failure: Failure, generation: number): boolean =>
    failure.control.kind === "fatal" ||
    failure.control.cutGeneration > generation

  /** Forget commits made inside the failing parser, so callers may backtrack. */
  const recoverAt = (failure: Failure, state: State): Reply<never> =>
    failRich(
      {
        ...failure,
        control: { kind: "recoverable", cutGeneration: state.cutGeneration }
      },
      state
    )

  /** Create the input adapter's error with the source and optional display name. */
  const errorAt = (diagnostic: Diagnostic, state: State, sourceName?: string) =>
    adapter.error(diagnostic, state.source, sourceName)

  /** Map a diagnostic to the adapter's position used to compare failures. */
  const failureOffset = (diagnostic: Diagnostic) =>
    adapter.failureOffset(diagnostic)

  class ParserValue<T> implements Parser<T> {
    declare readonly Type: T

    /** Register a runner, rejecting construction outside this engine. */
    constructor(token: symbol, runner: Runner<T>) {
      if (token !== parserToken)
        throw new TypeError("Parser values must be made by parser combinators")
      runners.set(this, runner as Runner<unknown>)
    }

    /** Transform a successful value while preserving the consumed input. */
    map<B>(f: (value: T) => B): Parser<B> {
      return makeParser(state => {
        const reply = runParser(this, state)
        return reply.result.ok
          ? replySuccess(f(reply.result.value), reply.state)
          : (reply as Reply<never> as Reply<B>)
      })
    }

    /** Choose the next parser from this value and continue at the resulting cursor. */
    flatMap<B>(f: (value: T) => Parser<B>): Parser<B> {
      return makeParser(state => {
        const reply = runParser(this, state)
        return reply.result.ok
          ? runParser(f(reply.result.value), reply.state)
          : (reply as Reply<never> as Reply<B>)
      })
    }

    /** Run both parsers in order and return their values as a pair. */
    zip<B>(other: Parser<B>): Parser<[T, B]> {
      return makeParser(state => {
        const left = runParser(this, state)
        if (!left.result.ok) return left as Reply<never> as Reply<[T, B]>
        const right = runParser(other, left.state)
        if (!right.result.ok) return right as Reply<never> as Reply<[T, B]>
        return replySuccess(
          [left.result.value, right.result.value],
          right.state
        )
      })
    }

    /** Run both parsers in order and retain the second result. */
    zipRight<B>(other: Parser<B>): Parser<B> {
      return makeParser(state => {
        const left = runParser(this, state)
        return left.result.ok
          ? runParser(other, left.state)
          : (left as Reply<never> as Reply<B>)
      })
    }

    /** Run both parsers in order and retain the first result. */
    zipLeft<B>(other: Parser<B>): Parser<T> {
      return makeParser(state => {
        const left = runParser(this, state)
        if (!left.result.ok) return left
        const right = runParser(other, left.state)
        return right.result.ok
          ? replySuccess(left.result.value, right.state)
          : (right as Reply<never> as Reply<T>)
      })
    }

    /** Allow generator grammars to read this parser with yield*. */
    *[Symbol.iterator](): Generator<Parser<T>, T, any> {
      return yield this
    }

    /** Replace a recoverable failure's message with a named expectation. */
    expected(description: string): Parser<T> {
      return makeParser(state => {
        const reply = runParser(this, state)
        if (reply.result.ok) return reply
        if (reply.result.failure.control.kind === "fatal") return reply
        const { message: _message, ...old } = reply.result.failure.diagnostic
        const diagnostic: Diagnostic = {
          ...old,
          kind: "expected",
          expected: [description]
        }
        return failRich(
          { ...reply.result.failure, diagnostic },
          reply.state
        ) as Reply<T>
      })
    }

    /** Add context to failures and remember it for unconsumed-input errors. */
    context(description: string): Parser<T> {
      return makeParser(state => {
        const reply = runParser(this, state)
        if (reply.result.ok) {
          const previous = reply.state.completionContext ?? []
          return makeReply(
            { ...reply.state, completionContext: [...previous, description] },
            reply.result
          )
        }
        const old = reply.result.failure.diagnostic
        const context = [...(old.context ?? []), description]
        return failRich(
          { ...reply.result.failure, diagnostic: { ...old, context } },
          reply.state
        ) as Reply<T>
      })
    }

    /** Transform the value together with the half-open span it consumed. */
    withSpan<B>(f: (value: T, span: Span) => B): Parser<B> {
      return makeParser(state => {
        const reply = runParser(this, state)
        return reply.result.ok
          ? replySuccess(
              f(reply.result.value, {
                start: state.offset,
                end: reply.state.offset
              }),
              reply.state
            )
          : (reply as Reply<never> as Reply<B>)
      })
    }

    /** Rejections point at the value that was parsed, not at what follows it. */
    validate(
      predicate: (value: T) => boolean | string,
      message = "valid value"
    ): Parser<T> {
      return makeParser(state => {
        const reply = runParser(this, state)
        if (!reply.result.ok) return reply
        const result = predicate(reply.result.value)
        if (result === true) return reply
        return failureAt(reply.state, {
          kind: "custom",
          span: { start: state.offset, end: reply.state.offset },
          message: typeof result === "string" ? result : message
        }) as Reply<T>
      })
    }

    /** Consume the supplied trivia parser before and after this value. */
    trim(trivia: Parser<unknown>): Parser<T> {
      return trivia.zipRight(this).zipLeft(trivia)
    }
    /** Consume the supplied trivia parser before this value. */
    trimLeft(trivia: Parser<unknown>): Parser<T> {
      return trivia.zipRight(this)
    }
    /** Consume the supplied trivia parser after this value. */
    trimRight(trivia: Parser<unknown>): Parser<T> {
      return this.zipLeft(trivia)
    }

    /** On success, prevent surrounding alternatives from recovering later failures. */
    commit(): Parser<T> {
      return makeParser(state => {
        const reply = runParser(this, state)
        return reply.result.ok
          ? makeReply(
              { ...reply.state, cutGeneration: reply.state.cutGeneration + 1 },
              reply.result
            )
          : reply
      })
    }

    /** Parse the whole input, returning a diagnostic error if any input remains. */
    parse(
      input: I,
      options: { readonly sourceName?: string } = {}
    ): ParseResult<T> {
      const reply = runParser(this, adapter.fromInput(input))
      if (!reply.result.ok)
        return {
          success: false,
          error: errorAt(
            reply.result.failure.diagnostic,
            reply.state,
            options.sourceName
          )
        }
      if (!adapter.isAtEnd(reply.state)) {
        const context = reply.state.completionContext
        return {
          success: false,
          error: errorAt(
            {
              ...expectedDiagnostic(reply.state, "end of input"),
              ...(context ? { context } : {})
            },
            reply.state,
            options.sourceName
          )
        }
      }
      return { success: true, value: reply.result.value }
    }

    /** Parse a prefix and return its value, final offset, and remaining input. */
    parsePrefix(
      input: I,
      options: { readonly sourceName?: string } = {}
    ): PrefixParseResult<T> {
      const reply = runParser(this, adapter.fromInput(input))
      if (!reply.result.ok)
        return {
          success: false,
          error: errorAt(
            reply.result.failure.diagnostic,
            reply.state,
            options.sourceName
          )
        }
      return {
        success: true,
        value: {
          value: reply.result.value,
          offset: reply.state.offset,
          rest: adapter.remaining(reply.state)
        }
      }
    }

    /** Parse the whole input and throw the diagnostic error on failure. */
    parseOrThrow(input: I, options: { readonly sourceName?: string } = {}): T {
      const result = this.parse(input, options)
      if (!result.success) throw result.error
      return result.value
    }
  }

  /** Runtime identity for parser values, without a public construct signature. */
  const Parser: { readonly prototype: Parser<unknown> } =
    Object.freeze(ParserValue)

  /** Run a parser at a state, rejecting values created by another engine. */
  function runParser<T>(parser: Parser<T>, state: State): Reply<T> {
    const runner = runners.get(parser) as Runner<T> | undefined
    if (!runner) throw new TypeError("Not a Parser")
    return runner(state)
  }

  /** Wrap a primitive runner in this engine's parser implementation. */
  function makeParser<T>(runner: Runner<T>): Parser<T> {
    return new ParserValue(parserToken, runner)
  }

  /** Return a constant value without consuming input. */
  function succeed<T>(value: T): Parser<T> {
    return makeParser(state => replySuccess(value, state))
  }

  /** Fails at the current position, or over `span` when the caller knows it. */
  function fail(message: string, span?: Span): Parser<never> {
    return makeParser(state =>
      failureAt(state, {
        kind: "custom",
        span: span ?? { start: state.offset, end: state.offset },
        message
      })
    )
  }

  /** Fail without allowing alternatives, attempts, or optional parsing to recover. */
  function fatal(message: string): Parser<never> {
    return makeParser(state =>
      failureAt(
        state,
        {
          kind: "fatal",
          span: { start: state.offset, end: state.offset },
          message
        },
        true
      )
    )
  }

  /** Run yielded parsers sequentially and close the generator on failure. */
  function parser<T>(f: () => Generator<Parser<any>, T, any>): Parser<T> {
    return makeParser(state => {
      const iterator = f()
      let closed = false
      /** Run generator cleanup at most once after an early exit. */
      const close = (): void => {
        if (closed) return
        closed = true
        iterator.return?.(undefined as never)
      }
      try {
        let current = iterator.next()
        let currentState = state
        while (!current.done) {
          const reply = runParser(current.value, currentState)
          if (!reply.result.ok) {
            close()
            return reply as Reply<never> as Reply<T>
          }
          currentState = reply.state
          current = iterator.next(reply.result.value)
        }
        closed = true
        return replySuccess(current.value, currentState)
      } catch (error) {
        close()
        throw error
      }
    })
  }

  /** Build a self-referencing grammar lazily on its first execution. */
  function recursive<T>(builder: (self: Parser<T>) => Parser<T>): Parser<T> {
    let built: Parser<T> | undefined
    const self: Parser<T> = makeParser(state =>
      runParser((built ??= builder(self)), state)
    )
    return self
  }

  /** Succeed without consuming when the inner parser fails nonfatally. */
  function notFollowedBy<T>(inner: Parser<T>): Parser<true> {
    return makeParser(state => {
      const reply = runParser(inner, state)
      if (!reply.result.ok) {
        if (reply.result.failure.control.kind === "fatal")
          return reply as Reply<never> as Reply<true>
        return replySuccess(true, state)
      }
      const { value: found } = adapter.peek(state)
      return failureAt(state, {
        kind: "unexpected",
        span: { start: state.offset, end: state.offset },
        found,
        message: "Unexpected following input"
      }) as Reply<true>
    })
  }

  /** Inspect a value without consuming input or retaining inner commits. */
  function lookahead<T>(inner: Parser<T>): Parser<T> {
    return makeParser(state => {
      const reply = runParser(inner, state)
      if (reply.result.ok) return replySuccess(reply.result.value, state)
      if (reply.result.failure.control.kind === "fatal")
        return reply as Reply<never> as Reply<T>
      return recoverAt(reply.result.failure, state) as Reply<T>
    })
  }

  /** Inspect a value without consuming, returning undefined on nonfatal failure. */
  function probe<T>(inner: Parser<T>): Parser<T | undefined> {
    return makeParser(state => {
      const reply = runParser(inner, state)
      if (reply.result.ok) return replySuccess(reply.result.value, state)
      if (reply.result.failure.control.kind === "fatal")
        return reply as Reply<never> as Reply<T | undefined>
      return replySuccess(undefined, state)
    })
  }

  /** Restore the starting state and undo inner commits on nonfatal failure. */
  function attempt<T>(inner: Parser<T>): Parser<T> {
    return makeParser(state => {
      const reply = runParser(inner, state)
      if (reply.result.ok || reply.result.failure.control.kind === "fatal")
        return reply
      return recoverAt(reply.result.failure, state) as Reply<T>
    })
  }

  /** Parse delimiters around a value and label a missing closing delimiter. */
  function between<T>(
    start: Parser<unknown>,
    end: Parser<unknown>,
    inner: Parser<T>
  ): Parser<T> {
    return start.zipRight(inner).zipLeft(end.expected("closing delimiter"))
  }

  /** Collect zero or more consuming matches; propagate committed or fatal failures. */
  function many<T>(inner: Parser<T>): Parser<T[]>
  function many(inner: Parser<any>): Parser<any[]>
  function many<T>(inner: Parser<T>): Parser<T[]> {
    return makeParser(state => {
      const values: T[] = []
      let current = state
      while (true) {
        const reply = runParser(inner, current)
        if (!reply.result.ok) {
          if (escapes(reply.result.failure, current.cutGeneration))
            return reply as Reply<never> as Reply<T[]>
          return replySuccess(values, current)
        }
        if (reply.state.offset <= current.offset)
          throw new Error("repeated parser must consume input")
        values.push(reply.result.value)
        current = reply.state
      }
    })
  }

  /** Discard zero or more consuming matches; propagate committed or fatal failures. */
  function skipMany<T>(inner: Parser<T>): Parser<void>
  function skipMany(inner: Parser<any>): Parser<void>
  function skipMany<T>(inner: Parser<T>): Parser<void> {
    return makeParser(state => {
      let current = state
      while (true) {
        const reply = runParser(inner, current)
        if (!reply.result.ok) {
          if (escapes(reply.result.failure, current.cutGeneration))
            return reply as Reply<never> as Reply<void>
          return replySuccess(undefined, current)
        }
        if (reply.state.offset <= current.offset)
          throw new Error("repeated parser must consume input")
        current = reply.state
      }
    })
  }

  /** Collect repeated consuming matches and fail when none are found. */
  function many1<T>(inner: Parser<T>): Parser<T[]>
  function many1(inner: Parser<any>): Parser<any[]>
  function many1<T>(inner: Parser<T>): Parser<T[]> {
    const repeated = many(inner)
    return makeParser(state => {
      const reply = runParser(repeated, state)
      if (!reply.result.ok || reply.result.value.length) return reply
      return failureAt(state, {
        kind: "expected",
        span: { start: state.offset, end: state.offset },
        expected: ["at least one item"]
      }) as Reply<T[]>
    })
  }

  /** Return undefined without consuming on an uncommitted, nonfatal failure. */
  function optional<T>(inner: Parser<T>): Parser<T | undefined>
  function optional(inner: Parser<any>): Parser<any>
  function optional<T>(inner: Parser<T>): Parser<T | undefined> {
    return makeParser(state => {
      const reply = runParser(inner, state)
      if (reply.result.ok) return replySuccess(reply.result.value, reply.state)
      if (escapes(reply.result.failure, state.cutGeneration))
        return reply as Reply<never> as Reply<T | undefined>
      return replySuccess(undefined, state)
    })
  }

  /** Collect repeated matches and require at least the given count. */
  function atLeast<T>(inner: Parser<T>, n: number): Parser<T[]> {
    ensureCount(n)
    return many(inner).flatMap(values =>
      values.length >= n
        ? succeed(values)
        : fail(`Expected at least ${n} occurrences`)
    )
  }

  /** Run the inner parser exactly n times and collect every value. */
  function count<T>(inner: Parser<T>, n: number): Parser<T[]> {
    ensureCount(n)
    return parser(function* () {
      const values: T[] = []
      for (let i = 0; i < n; i++) values.push(yield* inner)
      return values
    })
  }

  /** Parse a separated list with configurable empty and trailing-separator policies. */
  function list<T, S>(
    inner: Parser<T>,
    separator: Parser<S>,
    allowTrailing: boolean,
    requireOne: boolean
  ): Parser<T[]> {
    return makeParser(state => {
      const first = runParser(inner, state)
      if (!first.result.ok) {
        if (!requireOne && !escapes(first.result.failure, state.cutGeneration))
          return replySuccess([], state)
        return first as Reply<never> as Reply<T[]>
      }
      const values = [first.result.value]
      let current = first.state
      while (true) {
        const sep = runParser(separator, current)
        if (!sep.result.ok) {
          if (escapes(sep.result.failure, current.cutGeneration))
            return sep as Reply<never> as Reply<T[]>
          return replySuccess(values, current)
        }
        const item = runParser(inner, sep.state)
        if (!item.result.ok) {
          if (
            allowTrailing &&
            !escapes(item.result.failure, current.cutGeneration)
          )
            return replySuccess(values, sep.state)
          return item as Reply<never> as Reply<T[]>
        }
        if (item.state.offset <= sep.state.offset)
          throw new Error("list item must consume input")
        if (item.state.offset <= current.offset)
          throw new Error("list iteration must consume input")
        values.push(item.result.value)
        current = item.state
      }
    })
  }

  /** Parse zero or more separated values without allowing a trailing separator. */
  const sepBy = <T, S>(inner: Parser<T>, separator: Parser<S>): Parser<T[]> =>
    list(inner, separator, false, false)
  /** Parse one or more separated values without allowing a trailing separator. */
  const sepBy1 = <T, S>(inner: Parser<T>, separator: Parser<S>): Parser<T[]> =>
    list(inner, separator, false, true)
  /** Parse zero or more separated values with an optional trailing separator. */
  const sepEndBy = <T, S>(
    inner: Parser<T>,
    separator: Parser<S>
  ): Parser<T[]> => list(inner, separator, true, false)
  /** Parse one or more separated values with an optional trailing separator. */
  const sepEndBy1 = <T, S>(
    inner: Parser<T>,
    separator: Parser<S>
  ): Parser<T[]> => list(inner, separator, true, true)

  /** Try alternatives at one cursor until success, a commit, or a fatal failure. */
  function choice<Parsers extends readonly [Parser<any>, ...Parser<any>[]]>(
    ...parsers: Parsers
  ): Parser<Parsers[number] extends Parser<infer T> ? T : never>
  function choice(...parsers: Parser<any>[]): Parser<any> {
    if (parsers.length === 0)
      throw new TypeError("choice requires at least one parser")
    return makeParser(state => {
      const failures: Failure[] = []
      for (const alternative of parsers) {
        const reply = runParser(alternative, state)
        if (reply.result.ok) return reply
        if (escapes(reply.result.failure, state.cutGeneration)) return reply
        failures.push(reply.result.failure)
      }
      return failRich(
        mergeFailures(failures as [Failure, ...Failure[]], failureOffset),
        state
      )
    })
  }

  /** Run parsers in order and retain their values in a typed tuple. */
  const sequence = <const Parsers extends readonly Parser<unknown>[]>(
    parsers: Parsers
  ): Parser<{
    -readonly [K in keyof Parsers]: Parsers[K] extends Parser<infer T>
      ? T
      : never
  }> =>
    parser(function* () {
      const values: unknown[] = []
      for (const item of parsers) values.push(yield* item)
      return values as {
        -readonly [K in keyof Parsers]: Parsers[K] extends Parser<infer T>
          ? T
          : never
      }
    })

  /** Runs each field's parser in key order and collects the values into an object. */
  function struct<const Fields extends Record<string, Parser<unknown>>>(
    fields: Fields
  ): Parser<StructValue<Fields>> {
    const entries = Object.entries(fields)
    return makeParser(state => {
      const value: Record<string, unknown> = {}
      let current = state
      for (const [key, field] of entries) {
        const reply = runParser(field, current)
        if (!reply.result.ok)
          return reply as Reply<never> as Reply<StructValue<Fields>>
        Object.defineProperty(value, key, {
          value: reply.result.value,
          enumerable: true,
          configurable: true,
          writable: true
        })
        current = reply.state
      }
      return replySuccess(value as StructValue<Fields>, current)
    })
  }

  /** Advance the commit generation without consuming input. */
  const commit = (): Parser<void> =>
    makeParser(state =>
      replySuccess(undefined, {
        ...state,
        cutGeneration: state.cutGeneration + 1
      })
    )

  /** Run two parsers in order and return both values. */
  const zip = <A, B>(left: Parser<A>, right: Parser<B>): Parser<[A, B]> =>
    left.zip(right)
  /** Run two parsers in order and keep the right value. */
  const zipRight = <A, B>(left: Parser<A>, right: Parser<B>): Parser<B> =>
    left.zipRight(right)
  /** Run two parsers in order and keep the left value. */
  const zipLeft = <A, B>(left: Parser<A>, right: Parser<B>): Parser<A> =>
    left.zipLeft(right)

  /** Succeed only when the input adapter reports no remaining input. */
  const eof = makeParser<void>(state =>
    adapter.isAtEnd(state)
      ? replySuccess(undefined, state)
      : (expected(state, "end of input") as Reply<void>)
  )

  /** The current offset in the adapter's units. Text overrides this with line and column. */
  const position = makeParser<{ readonly offset: number }>(state =>
    replySuccess({ offset: state.offset }, state)
  )

  const combinators = {
    parser,
    recursive,
    succeed,
    fail,
    fatal,
    eof,
    position,
    notFollowedBy,
    lookahead,
    probe,
    attempt,
    commit,
    between,
    many,
    many1,
    skipMany,
    optional,
    atLeast,
    count,
    sepBy,
    sepBy1,
    sepEndBy,
    sepEndBy1,
    choice,
    sequence,
    struct,
    zip,
    zipRight,
    zipLeft
  }

  return {
    ...combinators,
    /** The public parsers alone, for building a namespace over them. */
    combinators,
    // Construction and replies, for writing primitives.
    Parser,
    makeParser,
    runParser,
    replySuccess,
    failRich,
    failureAt,
    expected,
    /** Combine alternative failures using this adapter's position units. */
    mergeFailures: (failures: readonly [Failure, ...Failure[]]): Failure =>
      mergeFailures(failures, failureOffset)
  }
}
