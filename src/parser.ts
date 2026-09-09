import { compile, planned, type Plan } from "./compiler.ts"
import type { Diagnostic, Failure, ParseError, Span } from "./errors.ts"
import { ParseError as ParseErrorClass, SourceText } from "./errors.ts"
import {
  ParserOutput,
  type ParserReply,
  type ParserState,
  State
} from "./state.ts"

export type ParseResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: ParseError }

export type PrefixResult<T> = {
  readonly value: T
  readonly offset: number
  readonly rest: string
}
export type PrefixParseResult<T> = ParseResult<PrefixResult<T>>

/** A parser value. Construction lives in the advanced entry point. */
export interface Parser<T> {
  /** Generate and cache a specialized parser. Requires runtime code generation. */
  compile(): Parser<T>
  map<B>(f: (value: T) => B): Parser<B>
  flatMap<B>(f: (value: T) => Parser<B>): Parser<B>
  zip<B>(other: Parser<B>): Parser<[T, B]>
  zipRight<B>(other: Parser<B>): Parser<B>
  zipLeft<B>(other: Parser<B>): Parser<T>
  [Symbol.iterator](): Generator<Parser<T>, T, any>
  expected(description: string): Parser<T>
  context(description: string): Parser<T>
  withSpan<B>(f: (value: T, span: Span) => B): Parser<B>
  validate(
    predicate: (value: T) => boolean | string,
    message?: string
  ): Parser<T>
  trim(trivia: Parser<unknown>): Parser<T>
  trimLeft(trivia: Parser<unknown>): Parser<T>
  trimRight(trivia: Parser<unknown>): Parser<T>
  commit(): Parser<T>
  parse(
    input: string,
    options?: { readonly sourceName?: string }
  ): ParseResult<T>
  parsePrefix(
    input: string,
    options?: { readonly sourceName?: string }
  ): PrefixParseResult<T>
  parseOrThrow(input: string, options?: { readonly sourceName?: string }): T
}

type Runner<T> = (state: ParserState) => ParserReply<T>
const runners = new WeakMap<object, Runner<unknown>>()
const parserToken = Symbol("Parser")

function clearCompletionContext(state: ParserState): ParserState {
  if (!state.completionContext) return state
  const { completionContext: _completionContext, ...rest } = state
  return rest
}

const successReply = <T>(value: T, state: ParserState): ParserReply<T> =>
  ParserOutput(clearCompletionContext(state), { ok: true, value })
export const replySuccess = successReply

class ParserValue<T> implements Parser<T> {
  constructor(token: symbol, runner: Runner<T>) {
    if (token !== parserToken)
      throw new TypeError("Parser values must be made by parser combinators")
    runners.set(this, runner as Runner<unknown>)
  }

  compile(): Parser<T> {
    return compile(this)
  }

  map<B>(f: (value: T) => B): Parser<B> {
    return makePlannedParser(
      state => {
        const reply = runParser(this, state)
        return reply.result.ok
          ? successReply(f(reply.result.value), reply.state)
          : (reply as ParserReply<never> as ParserReply<B>)
      },
      { kind: "map", inner: this, callback: f }
    )
  }

  flatMap<B>(f: (value: T) => Parser<B>): Parser<B> {
    return makePlannedParser(
      state => {
        const reply = runParser(this, state)
        return reply.result.ok
          ? runParser(f(reply.result.value), reply.state)
          : (reply as ParserReply<never> as ParserReply<B>)
      },
      { kind: "flatMap", inner: this, callback: f }
    )
  }

  zip<B>(other: Parser<B>): Parser<[T, B]> {
    return makePlannedParser(
      state => {
        const left = runParser(this, state)
        if (!left.result.ok)
          return left as ParserReply<never> as ParserReply<[T, B]>
        const right = runParser(other, left.state)
        if (!right.result.ok)
          return right as ParserReply<never> as ParserReply<[T, B]>
        return successReply(
          [left.result.value, right.result.value],
          right.state
        )
      },
      { kind: "zip", left: this, right: other }
    )
  }

  zipRight<B>(other: Parser<B>): Parser<B> {
    return makePlannedParser(
      state => {
        const left = runParser(this, state)
        return left.result.ok
          ? runParser(other, left.state)
          : (left as ParserReply<never> as ParserReply<B>)
      },
      { kind: "zipRight", left: this, right: other }
    )
  }

  zipLeft<B>(other: Parser<B>): Parser<T> {
    return makePlannedParser(
      state => {
        const left = runParser(this, state)
        if (!left.result.ok) return left
        const right = runParser(other, left.state)
        return right.result.ok
          ? successReply(left.result.value, right.state)
          : (right as ParserReply<never> as ParserReply<T>)
      },
      { kind: "zipLeft", left: this, right: other }
    )
  }

  *[Symbol.iterator](): Generator<Parser<T>, T, any> {
    return yield this
  }

  expected(description: string): Parser<T> {
    return transformParser(this, reply => {
      if (reply.result.ok) return reply
      if (reply.result.failure.control.kind === "fatal") return reply
      const old = reply.result.failure.diagnostic
      const { message: _message, ...withoutMessage } = old
      const diagnostic: Diagnostic = {
        ...withoutMessage,
        kind: "expected",
        expected: [description],
        span: old.span
      }
      return failRich(
        { ...reply.result.failure, diagnostic },
        reply.state
      ) as ParserReply<T>
    })
  }

  context(description: string): Parser<T> {
    return transformParser(this, reply => {
      if (reply.result.ok) {
        const previous = reply.state.completionContext ?? []
        return ParserOutput(
          { ...reply.state, completionContext: [...previous, description] },
          reply.result
        )
      }
      const old = reply.result.failure.diagnostic
      const context = [...(old.context ?? []), description]
      return failRich(
        { ...reply.result.failure, diagnostic: { ...old, context } },
        reply.state
      ) as ParserReply<T>
    })
  }

  withSpan<B>(f: (value: T, span: Span) => B): Parser<B> {
    return transformParser(this, (reply, state) => {
      return reply.result.ok
        ? successReply(
            f(reply.result.value, {
              start: state.offset,
              end: reply.state.offset
            }),
            reply.state
          )
        : (reply as ParserReply<never> as ParserReply<B>)
    })
  }

  validate(
    predicate: (value: T) => boolean | string,
    message = "valid value"
  ): Parser<T> {
    return this.flatMap(value => {
      const result = predicate(value)
      return result === true
        ? succeed(value)
        : fail(typeof result === "string" ? result : message)
    })
  }

  trim(trivia: Parser<unknown>): Parser<T> {
    return trivia.zipRight(this).zipLeft(trivia)
  }
  trimLeft(trivia: Parser<unknown>): Parser<T> {
    return trivia.zipRight(this)
  }
  trimRight(trivia: Parser<unknown>): Parser<T> {
    return this.zipLeft(trivia)
  }

  commit(): Parser<T> {
    return transformParser(this, reply => {
      return reply.result.ok
        ? ParserOutput(
            {
              ...reply.state,
              cutGeneration: reply.state.cutGeneration + 1
            },
            reply.result
          )
        : reply
    })
  }

  parse(
    input: string,
    options: { readonly sourceName?: string } = {}
  ): ParseResult<T> {
    const reply = runParser(this, State.fromInput(input))
    if (!reply.result.ok)
      return {
        success: false,
        error: errorFromReply(reply, options.sourceName)
      }
    if (!State.isAtEnd(reply.state)) {
      const found = State.charAt(reply.state)
      return {
        success: false,
        error: new ParseErrorClass(
          {
            kind: "expected",
            span: {
              start: reply.state.offset,
              end: reply.state.offset + State.charWidthAt(reply.state)
            },
            expected: ["end of input"],
            found,
            ...(reply.state.completionContext
              ? { context: reply.state.completionContext }
              : {})
          },
          new SourceText(input, options.sourceName)
        )
      }
    }
    return { success: true, value: reply.result.value }
  }

  parsePrefix(
    input: string,
    options: { readonly sourceName?: string } = {}
  ): PrefixParseResult<T> {
    const reply = runParser(this, State.fromInput(input))
    if (!reply.result.ok)
      return {
        success: false,
        error: errorFromReply(reply, options.sourceName)
      }
    const rest = input.slice(reply.state.offset)
    return {
      success: true,
      value: { value: reply.result.value, offset: reply.state.offset, rest }
    }
  }

  parseOrThrow(
    input: string,
    options: { readonly sourceName?: string } = {}
  ): T {
    const result = this.parse(input, options)
    if (!result.success) throw result.error
    return result.value
  }
}

/** Runtime identity for parser values, without a public construct signature. */
export const Parser: { readonly prototype: Parser<unknown> } =
  Object.freeze(ParserValue)

function errorFromReply(
  reply: ParserReply<unknown>,
  sourceName?: string
): ParseError {
  const diagnostic = reply.result.ok
    ? {
        kind: "custom" as const,
        span: { start: reply.state.offset, end: reply.state.offset },
        message: "Parser failed"
      }
    : reply.result.failure.diagnostic
  return new ParseErrorClass(
    diagnostic,
    new SourceText(reply.state.source, sourceName)
  )
}

export function runParser<T>(
  parser: Parser<T>,
  state: ParserState
): ParserReply<T> {
  return getRunner(parser)(state)
}

export function getRunner<T>(parser: Parser<T>): Runner<T> {
  const runner = runners.get(parser) as Runner<T> | undefined
  if (!runner) throw new TypeError("Not a Parser")
  return runner
}

/** Internal construction with compiler metadata; advanced makeParser stays opaque. */
export function makePlannedParser<T>(runner: Runner<T>, plan: Plan): Parser<T> {
  return planned(makeParser(runner), plan)
}

export function transformParser<A, B>(
  inner: Parser<A>,
  transform: (reply: ParserReply<A>, entry: ParserState) => ParserReply<B>
): Parser<B> {
  return makePlannedParser(state => transform(runParser(inner, state), state), {
    kind: "reply",
    inner,
    transform
  })
}

export function makeParser<T>(runner: Runner<T>): Parser<T> {
  return new ParserValue(parserToken, runner)
}

export function succeed<T>(value: T): Parser<T> {
  return makePlannedParser(current => successReply(value, current), {
    kind: "succeed",
    value
  })
}

export function fail(message: string): Parser<never> {
  return makeParser(state =>
    ParserOutput(state, {
      ok: false,
      failure: {
        diagnostic: {
          kind: "custom",
          span: { start: state.offset, end: state.offset },
          message
        },
        control: { kind: "recoverable", cutGeneration: state.cutGeneration }
      }
    })
  )
}

export function fatal(message: string): Parser<never> {
  return makeParser(state =>
    ParserOutput(state, {
      ok: false,
      failure: {
        diagnostic: {
          kind: "fatal",
          span: { start: state.offset, end: state.offset },
          message
        },
        control: { kind: "fatal" }
      }
    })
  )
}

export function failRich(
  failure: Failure,
  state: ParserState
): ParserReply<never> {
  return ParserOutput(state, { ok: false, failure })
}

export function parser<T>(f: () => Generator<Parser<any>, T, any>): Parser<T> {
  return makePlannedParser(
    state => {
      const iterator = f()
      let closed = false
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
            return reply as ParserReply<never> as ParserReply<T>
          }
          currentState = reply.state
          current = iterator.next(reply.result.value)
        }
        closed = true
        return successReply(current.value, currentState)
      } catch (error) {
        close()
        throw error
      }
    },
    { kind: "generator", factory: f }
  )
}

export function recursive<T>(
  builder: (self: Parser<T>) => Parser<T>
): Parser<T> {
  let built: Parser<T> | undefined
  const get = () => (built ??= builder(self))
  const self: Parser<T> = makePlannedParser(state => runParser(get(), state), {
    kind: "recursive",
    get
  })
  return self
}
