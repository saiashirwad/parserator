import { ensureCount } from "./core.ts"
import type { Failure } from "./errors.ts"
import {
  type Parser,
  textEngine,
  makeParser,
  runParser,
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
  State
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

export const position: Parser<SourcePosition> = makeParser(state =>
  replySuccess(State.toPosition(state), state)
)

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
