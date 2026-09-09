import { ensureCount, isFinal, waitForInput } from "./core.ts"
import type { Failure } from "./errors.ts"
import {
  type Parser,
  textEngine,
  makeParser,
  makeRead,
  makeResumable,
  runResumable,
  replySuccess,
  fail,
  failRich,
  failureAt,
  expected,
  mergeFailures,
  succeed
} from "./parser.ts"
import {
  type ParserReply,
  type ParserState,
  type SourcePosition,
  State,
  hasPoint,
  waitForPoint
} from "./state.ts"

const digitTest = (c: string) => c >= "0" && c <= "9"
const letterTest = (c: string) =>
  (c >= "a" && c <= "z") || (c >= "A" && c <= "Z")
const alphanumericTest = (c: string) => letterTest(c) || digitTest(c)
const whitespaceTest = (c: string) =>
  c === " " || c === "\t" || c === "\n" || c === "\r"

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

export const literal = <const S extends string>(value: S): Parser<S> => {
  const read = (state: ParserState): ParserReply<S> =>
    State.startsWith(state, value)
      ? replySuccess(value, State.consume(state, value.length))
      : literalFailure(state, value)
  function* match(state: ParserState): Generator<void, ParserReply<S>, void> {
    for (let index = 0; index < value.length; index++) {
      const offset = state.offset + index
      while (offset >= state.source.length && !isFinal(state))
        yield* waitForInput(state)
      if (state.source[offset] !== value[index]) {
        yield* waitForPoint(state, offset)
        return literalFailure(state, value)
      }
    }
    return read(state)
  }
  return makeResumable(state =>
    isFinal(state) || State.startsWith(state, value)
      ? read(state)
      : match(state)
  )
}

export const oneOfLiterals = <
  const Values extends readonly [string, ...string[]]
>(
  ...values: Values
): Parser<Values[number]> => {
  if (values.length === 0)
    throw new TypeError("oneOfLiterals requires at least one literal")
  const sorted = [...values].sort((a, b) => b.length - a.length)
  const alternatives = sorted.map(value => literal(value))
  return makeResumable(function* (state) {
    const failures = new Map<string, Failure>()
    for (let index = 0; index < alternatives.length; index++) {
      const reply = yield* runResumable(alternatives[index]!, state)
      if (reply.result.ok) return reply as ParserReply<Values[number]>
      failures.set(sorted[index]!, reply.result.failure)
    }
    return failRich(
      mergeFailures(
        values.map(value => failures.get(value)!) as [Failure, ...Failure[]]
      ),
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
  return makeRead(
    state =>
      State.charAt(state) === value
        ? replySuccess(value, State.consume(state, value.length))
        : (expected(state, JSON.stringify(value)) as ParserReply<C>),
    hasPoint
  )
}

export function satisfy(
  predicate: (char: string) => boolean,
  description = "character"
): Parser<string> {
  return makeRead(state => {
    const value = State.charAt(state)
    return value && predicate(value)
      ? replySuccess(value, State.consume(state, value.length))
      : (expected(state, description) as ParserReply<string>)
  }, hasPoint)
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

export function takeWhileChar(
  predicate: (char: string) => boolean
): Parser<string> {
  return makeResumable(function* (state) {
    if (isFinal(state)) {
      const end = State.consumeWhile(state, predicate)
      return replySuccess(state.source.slice(state.offset, end.offset), end)
    }
    let current = state
    while (true) {
      yield* waitForPoint(current)
      const value = State.charAt(current)
      if (!value || !predicate(value)) break
      current = State.consume(current, State.charWidthAt(current))
    }
    return replySuccess(
      state.source.slice(state.offset, current.offset),
      current
    )
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

function scanUntil<T>(inner: Parser<T>, consumeMatch: boolean): Parser<string> {
  return makeResumable(function* (state) {
    let current = state
    while (true) {
      const reply = yield* runResumable(inner, current)
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
      yield* waitForPoint(current)
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

export const position: Parser<SourcePosition> = makeResumable(
  function* (state) {
    // A trailing CR may join an LF; resolve that boundary before computing lines.
    while (
      !isFinal(state) &&
      state.offset === state.source.length &&
      state.source.endsWith("\r")
    )
      yield* waitForInput(state)
    return replySuccess(State.toPosition(state), state)
  }
)

export function takeN(n: number): Parser<string> {
  ensureCount(n)
  return makeResumable(function* (state) {
    let current = state
    for (let index = 0; index < n; index++) {
      yield* waitForPoint(current)
      const value = State.charAt(current)
      if (!value)
        return expected(state, `${n} characters`) as ParserReply<string>
      current = State.consume(current, State.charWidthAt(current))
    }
    // Preserve the existing replacement-character behavior on malformed UTF-16.
    const value = State.peek(state, n)
    return replySuccess(value, current)
  })
}

export const {
  eof,
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
} = textEngine
