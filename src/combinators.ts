import type { Diagnostic, Failure } from "./errors.ts"
import {
  Parser,
  parser,
  recursive,
  makeParser,
  runParser,
  replySuccess,
  fail,
  failRich,
  succeed
} from "./parser.ts"
import {
  ParserOutput,
  type ParserReply,
  type ParserState,
  type SourcePosition,
  State
} from "./state.ts"

const digitTest = (c: string) => c >= "0" && c <= "9"
const letterTest = (c: string) =>
  (c >= "a" && c <= "z") || (c >= "A" && c <= "Z")
const alphanumericTest = (c: string) => letterTest(c) || digitTest(c)
const whitespaceTest = (c: string) =>
  c === " " || c === "\t" || c === "\n" || c === "\r"

const failureAt = (
  state: ParserState,
  diagnostic: Diagnostic,
  fatal = false
): ParserReply<never> =>
  ParserOutput(state, {
    ok: false,
    failure: {
      diagnostic,
      control: fatal
        ? { kind: "fatal" }
        : { kind: "recoverable", cutGeneration: state.cutGeneration }
    }
  })

const expected = (
  state: ParserState,
  item: string,
  message?: string
): ParserReply<never> => {
  const found = State.charAt(state)
  return failureAt(state, {
    kind: "expected",
    span: {
      start: state.offset,
      end: state.offset + State.charWidthAt(state)
    },
    expected: [item],
    ...(message ? { message } : {}),
    ...(found ? { found } : {})
  })
}

function contextSize(diagnostic: Diagnostic): number {
  return diagnostic.context?.length ?? 0
}

function mostSpecific(failures: readonly Failure[]): Failure {
  return failures.reduce((best, candidate) =>
    contextSize(candidate.diagnostic) > contextSize(best.diagnostic)
      ? candidate
      : best
  )
}

function mergeFailures(failures: readonly [Failure, ...Failure[]]): Failure {
  const furthest = Math.max(...failures.map(f => f.diagnostic.span.start))
  const atFurthest = failures.filter(f => f.diagnostic.span.start === furthest)
  const custom = atFurthest.filter(
    failure =>
      failure.diagnostic.kind === "custom" ||
      failure.diagnostic.message !== undefined
  )
  const expectedFailures = atFurthest.filter(
    failure => failure.diagnostic.kind === "expected"
  )
  const base = mostSpecific(
    (custom.length
      ? custom
      : expectedFailures.length
        ? expectedFailures
        : atFurthest) as [Failure, ...Failure[]]
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
        start: furthest,
        end: Math.max(
          furthest,
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

function literalFailure(state: ParserState, value: string): ParserReply<never> {
  let inputOffset = state.offset
  for (const expectedPoint of value) {
    const pointState = { ...state, offset: inputOffset }
    const found = State.charAt(pointState)
    const width = State.charWidthAt(pointState)
    const rawFound = state.source.slice(inputOffset, inputOffset + width)
    if (!found || rawFound !== expectedPoint) {
      return failureAt(state, {
        kind: "expected",
        span: { start: inputOffset, end: inputOffset + width },
        expected: [JSON.stringify(value)],
        ...(found ? { found } : {})
      })
    }
    inputOffset += width
  }

  return failureAt(state, {
    kind: "expected",
    span: { start: inputOffset, end: inputOffset },
    expected: [JSON.stringify(value)]
  })
}

export const literal = <const S extends string>(value: S): Parser<S> =>
  makeParser(state => {
    if (State.startsWith(state, value)) {
      return replySuccess(value, State.consume(state, value.length))
    }
    return literalFailure(state, value) as ParserReply<S>
  })

export const oneOfLiterals = <
  const Values extends readonly [string, ...string[]]
>(
  ...values: Values
): Parser<Values[number]> => {
  if (values.length === 0)
    throw new TypeError("oneOfLiterals requires at least one literal")
  const sorted = [...values].sort((a, b) => b.length - a.length)
  return makeParser(state => {
    for (const value of sorted)
      if (State.startsWith(state, value))
        return replySuccess(
          value as Values[number],
          State.consume(state, value.length)
        )
    const failures = values
      .map(value => {
        const reply = literalFailure(state, value)
        return reply.result.ok ? undefined : reply.result.failure
      })
      .filter((failure): failure is Failure => failure !== undefined)
    return failRich(
      mergeFailures(failures as [Failure, ...Failure[]]),
      state
    ) as ParserReply<Values[number]>
  })
}

export const char = <const C extends string>(value: C): Parser<C> => {
  const code = value.codePointAt(0)
  if (
    [...value].length !== 1 ||
    code === undefined ||
    (code >= 0xd800 && code <= 0xdfff)
  ) {
    throw new TypeError("char expects one Unicode code point")
  }
  return makeParser(state =>
    State.charAt(state) === value
      ? replySuccess(value, State.consume(state, value.length))
      : (expected(state, JSON.stringify(value)) as ParserReply<C>)
  )
}

export function satisfy(
  predicate: (char: string) => boolean,
  description = "character"
): Parser<string> {
  return makeParser(state => {
    const value = State.charAt(state)
    return value && predicate(value)
      ? replySuccess(value, State.consume(state, value.length))
      : (expected(state, description) as ParserReply<string>)
  })
}

export function anyChar(): Parser<string> {
  return satisfy(() => true, "any character")
}

export const digit = satisfy(digitTest, "digit")
export const asciiLetter = satisfy(letterTest, "ASCII letter")
export const asciiAlphanumeric = satisfy(
  alphanumericTest,
  "ASCII alphanumeric character"
)
export const whitespace = satisfy(whitespaceTest, "whitespace")

export function oneOfChars(chars: string): Parser<string> {
  if (!chars) throw new TypeError("oneOfChars requires at least one character")
  return satisfy(
    value => chars.includes(value),
    `one of ${JSON.stringify(chars)}`
  )
}

export function notFollowedBy<T>(inner: Parser<T>): Parser<true> {
  return makeParser(state => {
    const reply = runParser(inner, state)
    if (!reply.result.ok) {
      const control = reply.result.failure.control
      if (control.kind === "fatal") {
        return reply as ParserReply<never> as ParserReply<true>
      }
      return replySuccess(true, state)
    }
    return failureAt(state, {
      kind: "unexpected",
      span: { start: state.offset, end: state.offset },
      found: State.charAt(state),
      message: "Unexpected following input"
    }) as ParserReply<true>
  })
}

export function lookahead<T>(inner: Parser<T>): Parser<T> {
  return makeParser(state => {
    const reply = runParser(inner, state)
    if (!reply.result.ok) {
      if (reply.result.failure.control.kind === "fatal") {
        return reply as ParserReply<never> as ParserReply<T>
      }
      return failRich(
        {
          ...reply.result.failure,
          control: { kind: "recoverable", cutGeneration: state.cutGeneration }
        },
        state
      ) as ParserReply<T>
    }
    return replySuccess(reply.result.value, state)
  })
}

export function probe<T>(inner: Parser<T>): Parser<T | undefined> {
  return makeParser(state => {
    const reply = runParser(inner, state)
    if (reply.result.ok) return replySuccess(reply.result.value, state)
    if (reply.result.failure.control.kind === "fatal") {
      return reply as ParserReply<never> as ParserReply<T | undefined>
    }
    return replySuccess(undefined, state)
  })
}

export function takeWhileChar(
  predicate: (char: string) => boolean
): Parser<string> {
  return makeParser(state => {
    const end = State.consumeWhile(state, predicate)
    return replySuccess(state.source.slice(state.offset, end.offset), end)
  })
}
export function takeWhileChar1(
  predicate: (char: string) => boolean,
  description: string
): Parser<string> {
  return takeWhileChar(predicate).flatMap(value =>
    value ? succeed(value) : fail(`Expected at least one ${description}`)
  )
}
export const takeUntilChar = (
  predicate: (char: string) => boolean
): Parser<string> => takeWhileChar(c => !predicate(c))
export const skipWhitespace = takeWhileChar(whitespaceTest).map(() => undefined)
export const skipSpaces = takeWhileChar(c => c === " ").map(() => undefined)
export const manyDigit = () => takeWhileChar(digitTest).map(value => [...value])
export const many1Digit = () =>
  takeWhileChar1(digitTest, "digit").map(value => [...value])
export const manyAlphabet = () =>
  takeWhileChar(letterTest).map(value => [...value])
export const many1Alphabet = () =>
  takeWhileChar1(letterTest, "letter").map(value => [...value])
export const manyAlphanumeric = () =>
  takeWhileChar(alphanumericTest).map(value => [...value])
export const many1Alphanumeric = () =>
  takeWhileChar1(alphanumericTest, "alphanumeric character").map(value => [
    ...value
  ])
export const manyWhitespace = () =>
  takeWhileChar(whitespaceTest).map(value => [...value])

export function between<T>(
  start: Parser<unknown>,
  end: Parser<unknown>,
  inner: Parser<T>
): Parser<T> {
  return start.zipRight(inner).zipLeft(end.expected("closing delimiter"))
}

function ensureCount(n: number): void {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError("count must be a safe nonnegative integer")
}

export function many<T>(inner: Parser<T>): Parser<T[]>
export function many(inner: Parser<any>): Parser<any[]>
export function many<T>(inner: Parser<T>): Parser<T[]> {
  return makeParser(state => {
    const values: T[] = []
    let current = state
    while (true) {
      const entryGeneration = current.cutGeneration
      const reply = runParser(inner, current)
      if (!reply.result.ok) {
        const control = reply.result.failure.control
        if (
          control.kind === "fatal" ||
          (control.kind === "recoverable" &&
            control.cutGeneration > entryGeneration)
        )
          return reply as ParserReply<never> as ParserReply<T[]>
        return replySuccess(values, current)
      }
      if (reply.state.offset <= current.offset)
        throw new Error("repeated parser must consume input")
      values.push(reply.result.value)
      current = reply.state
    }
  })
}

export function optional<T>(inner: Parser<T>): Parser<T | undefined>
export function optional(inner: Parser<any>): Parser<any>
export function optional<T>(inner: Parser<T>): Parser<T | undefined> {
  return makeParser(state => {
    const reply = runParser(inner, state)
    if (reply.result.ok) return replySuccess(reply.result.value, reply.state)
    const control = reply.result.failure.control
    if (control.kind === "fatal" || control.cutGeneration > state.cutGeneration)
      return reply as ParserReply<never> as ParserReply<T | undefined>
    return replySuccess(undefined, state)
  })
}

export function many1<T>(inner: Parser<T>): Parser<T[]>
export function many1(inner: Parser<any>): Parser<any[]>
export function many1<T>(inner: Parser<T>): Parser<T[]> {
  return makeParser(state => {
    const reply = runParser(many(inner), state)
    if (!reply.result.ok) return reply
    if (reply.result.value.length) return reply
    return failureAt(state, {
      kind: "expected",
      span: { start: state.offset, end: state.offset },
      expected: ["at least one item"]
    }) as ParserReply<T[]>
  })
}

export function atLeast<T>(inner: Parser<T>, n: number): Parser<T[]> {
  ensureCount(n)
  return many(inner).flatMap(values =>
    values.length >= n
      ? succeed(values)
      : fail(`Expected at least ${n} occurrences`)
  )
}

export function count<T>(inner: Parser<T>, n: number): Parser<T[]> {
  ensureCount(n)
  return parser(function* () {
    const values: T[] = []
    for (let i = 0; i < n; i++) values.push(yield* inner)
    return values
  })
}

function list<T, S>(
  inner: Parser<T>,
  separator: Parser<S>,
  allowTrailing: boolean,
  requireOne: boolean
): Parser<T[]> {
  return makeParser(state => {
    const first = runParser(inner, state)
    if (!first.result.ok) {
      if (
        !requireOne &&
        first.result.failure.control.kind === "recoverable" &&
        first.result.failure.control.cutGeneration <= state.cutGeneration
      ) {
        return replySuccess([], state)
      }
      return first as ParserReply<never> as ParserReply<T[]>
    }
    const values = [first.result.value]
    let current = first.state
    while (true) {
      const iterationGeneration = current.cutGeneration
      const sep = runParser(separator, current)
      if (!sep.result.ok) {
        const control = sep.result.failure.control
        if (
          control.kind === "fatal" ||
          (control.kind === "recoverable" &&
            control.cutGeneration > iterationGeneration)
        ) {
          return sep as ParserReply<never> as ParserReply<T[]>
        }
        return replySuccess(values, current)
      }
      const item = runParser(inner, sep.state)
      if (!item.result.ok) {
        const control = item.result.failure.control
        if (
          control.kind === "fatal" ||
          (control.kind === "recoverable" &&
            control.cutGeneration > iterationGeneration)
        ) {
          return item as ParserReply<never> as ParserReply<T[]>
        }
        if (allowTrailing) return replySuccess(values, sep.state)
        return item as ParserReply<never> as ParserReply<T[]>
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

export const sepBy = <T, S>(
  inner: Parser<T>,
  separator: Parser<S>
): Parser<T[]> => list(inner, separator, false, false)
export const sepBy1 = <T, S>(
  inner: Parser<T>,
  separator: Parser<S>
): Parser<T[]> => list(inner, separator, false, true)
export const sepEndBy = <T, S>(
  inner: Parser<T>,
  separator: Parser<S>
): Parser<T[]> => list(inner, separator, true, false)
export const sepEndBy1 = <T, S>(
  inner: Parser<T>,
  separator: Parser<S>
): Parser<T[]> => list(inner, separator, true, true)

export function skipMany<T>(inner: Parser<T>): Parser<void>
export function skipMany(inner: Parser<any>): Parser<void>
export function skipMany<T>(inner: Parser<T>): Parser<void> {
  return makeParser(state => {
    let current = state
    while (true) {
      const entryGeneration = current.cutGeneration
      const reply = runParser(inner, current)
      if (!reply.result.ok) {
        const control = reply.result.failure.control
        if (
          control.kind === "fatal" ||
          (control.kind === "recoverable" &&
            control.cutGeneration > entryGeneration)
        ) {
          return reply as ParserReply<never> as ParserReply<void>
        }
        return replySuccess(undefined, current)
      }
      if (reply.state.offset <= current.offset)
        throw new Error("repeated parser must consume input")
      current = reply.state
    }
  })
}

function scanUntil<T>(inner: Parser<T>, consumeMatch: boolean): Parser<string> {
  return makeParser(state => {
    let current = state
    while (true) {
      const reply = runParser(inner, current)
      if (reply.result.ok) {
        const end = consumeMatch
          ? { ...reply.state, cutGeneration: current.cutGeneration }
          : current
        return replySuccess(
          state.source.slice(state.offset, current.offset),
          end
        )
      }
      const control = reply.result.failure.control
      if (control.kind === "fatal") {
        return reply as ParserReply<never> as ParserReply<string>
      }
      if (State.isAtEnd(current)) {
        return replySuccess(state.source.slice(state.offset), current)
      }
      current = State.consume(current, State.charWidthAt(current))
    }
  })
}
export const takeUntil = <T>(inner: Parser<T>): Parser<string> =>
  scanUntil(inner, true)
export const takeUpto = <T>(inner: Parser<T>): Parser<string> =>
  scanUntil(inner, false)
export const skipUntil = <T>(inner: Parser<T>): Parser<void> =>
  scanUntil(inner, true).map(() => undefined)

export function choice<
  Parsers extends readonly [Parser<any>, ...Parser<any>[]]
>(
  ...parsers: Parsers
): Parser<Parsers[number] extends Parser<infer T> ? T : never>
export function choice(...parsers: Parser<any>[]): Parser<any> {
  if (parsers.length === 0)
    throw new TypeError("choice requires at least one parser")
  return makeParser(state => {
    const failures: Failure[] = []
    for (const alternative of parsers) {
      const reply = runParser(alternative, state)
      if (reply.result.ok) return reply
      const failure = reply.result.failure
      if (
        failure.control.kind === "fatal" ||
        (failure.control.kind === "recoverable" &&
          failure.control.cutGeneration > state.cutGeneration)
      )
        return reply
      failures.push(failure)
    }
    return failRich(mergeFailures(failures as [Failure, ...Failure[]]), state)
  })
}

export const sequence = <const Parsers extends readonly Parser<unknown>[]>(
  parsers: Parsers
): Parser<{
  -readonly [K in keyof Parsers]: Parsers[K] extends Parser<infer T> ? T : never
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

export const regex = (expression: RegExp): Parser<string> => {
  const flags = `${expression.flags.replace(/[gy]/g, "")}y`
  const sticky = new RegExp(expression.source, flags)
  return makeParser(state => {
    sticky.lastIndex = state.offset
    const match = sticky.exec(state.source)
    if (match?.index === state.offset) {
      const end = sticky.lastIndex
      return replySuccess(
        state.source.slice(state.offset, end),
        State.consume(state, end - state.offset)
      )
    }
    return expected(state, expression.toString()) as ParserReply<string>
  })
}

export const eof = makeParser<void>(state =>
  State.isAtEnd(state)
    ? replySuccess(undefined, state)
    : (expected(state, "end of input") as ParserReply<void>)
)
export const position: Parser<SourcePosition> = makeParser(state =>
  replySuccess(State.toPosition(state), state)
)
export const commit = (): Parser<void> =>
  makeParser(state =>
    replySuccess(undefined, {
      ...state,
      cutGeneration: state.cutGeneration + 1
    })
  )
export const lookaheadParser = lookahead

export function attempt<T>(inner: Parser<T>): Parser<T> {
  return makeParser(state => {
    const reply = runParser(inner, state)
    if (reply.result.ok || reply.result.failure.control.kind === "fatal")
      return reply
    return failRich(
      {
        ...reply.result.failure,
        control: { kind: "recoverable", cutGeneration: state.cutGeneration }
      },
      { ...state }
    ) as ParserReply<T>
  })
}

export const zip = <A, B>(left: Parser<A>, right: Parser<B>): Parser<[A, B]> =>
  left.zip(right)
export const zipRight = <A, B>(left: Parser<A>, right: Parser<B>): Parser<B> =>
  left.zipRight(right)
export const zipLeft = <A, B>(left: Parser<A>, right: Parser<B>): Parser<A> =>
  left.zipLeft(right)

export function takeN(n: number): Parser<string> {
  ensureCount(n)
  return makeParser(state => {
    const value = State.peek(state, n)
    if ([...value].length < n) {
      return expected(state, `${n} characters`) as ParserReply<string>
    }
    return replySuccess(value, State.consume(state, value.length))
  })
}

export const recursiveParser = recursive
