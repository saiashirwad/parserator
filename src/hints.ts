import type { Diagnostic } from "./errors.ts"
import {
  failRich,
  makeParser,
  replySuccess,
  runParser,
  type Parser
} from "./parser.ts"
import type { ParserState } from "./state.ts"
import { State } from "./state.ts"

export function levenshteinDistance(a: string, b: string): number {
  let previous = Array.from({ length: a.length + 1 }, (_, index) => index)
  for (let j = 1; j <= b.length; j++) {
    const current = [j]
    for (let i = 1; i <= a.length; i++)
      current[i] = Math.min(
        current[i - 1]! + 1,
        previous[i]! + 1,
        previous[i - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    previous = current
  }
  return previous[a.length]!
}

export function generateHints(
  found: string,
  expected: readonly string[],
  maxDistance = 2,
  maxHints = 3
): string[] {
  return expected
    .map(word => ({ word, distance: levenshteinDistance(found, word) }))
    .filter(item => item.distance > 0 && item.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxHints)
    .map(item => item.word)
}

const identifierChar = (char: string): boolean => /[A-Za-z0-9_']/u.test(char)

function identifierAt(state: ParserState): string {
  const remaining = State.remaining(state)
  const match = remaining.match(/^[A-Za-z_][A-Za-z0-9_']*/u)
  return match?.[0] ?? State.charAt(state)
}

function keywordFailure(
  state: ParserState,
  found: string,
  expected: readonly string[],
  keywords: readonly string[]
): ReturnType<typeof makeParser<never>> {
  const hints = generateHints(found, keywords)
  const diagnostic: Diagnostic = {
    kind: "expected",
    span: { start: state.offset, end: state.offset + found.length },
    expected: expected.map(value => JSON.stringify(value)),
    ...(found ? { found } : {}),
    ...(hints.length ? { hints } : {})
  }
  return makeParser(current =>
    failRich(
      {
        diagnostic,
        control: { kind: "recoverable", cutGeneration: current.cutGeneration }
      },
      current
    )
  )
}

function sanitizeText(value: string): string {
  let result = ""
  for (let offset = 0; offset < value.length;) {
    const state: ParserState = {
      source: value,
      offset,
      cutGeneration: 0
    }
    const point = State.charAt(state)
    result += point
    offset += State.charWidthAt(state)
  }
  return result
}

function keywordParser(
  keyword: string,
  keywords: readonly string[]
): Parser<string> {
  return makeParser(state => {
    if (State.startsWith(state, keyword)) {
      const next = state.source[state.offset + keyword.length] ?? ""
      if (!next || !identifierChar(next))
        return replySuccess(keyword, State.consume(state, keyword.length))
    }
    return runParser(
      keywordFailure(state, identifierAt(state), [keyword], keywords),
      state
    )
  })
}

export const keywordWithHints =
  (keywords: readonly string[]) =>
  (keyword: string): Parser<string> =>
    keywordParser(keyword, keywords)

export function anyKeywordWithHints(
  keywords: readonly string[]
): Parser<string> {
  const sorted = [...keywords].sort((a, b) => b.length - a.length)
  return makeParser(state => {
    for (const keyword of sorted) {
      if (State.startsWith(state, keyword)) {
        const next = state.source[state.offset + keyword.length] ?? ""
        if (!next || !identifierChar(next))
          return replySuccess(keyword, State.consume(state, keyword.length))
      }
    }
    return runParser(
      keywordFailure(state, identifierAt(state), sorted, sorted),
      state
    )
  })
}

export function stringWithHints(
  validStrings: readonly string[]
): Parser<string> {
  return makeParser(state => {
    if (State.charAt(state) !== '"') {
      const found = State.charAt(state)
      return failRich(
        {
          diagnostic: {
            kind: "expected",
            span: { start: state.offset, end: state.offset + found.length },
            expected: ["string literal"],
            ...(found ? { found } : {})
          },
          control: { kind: "recoverable", cutGeneration: state.cutGeneration }
        },
        state
      )
    }
    let offset = state.offset + 1
    while (offset < state.source.length && state.source[offset] !== '"')
      offset++
    if (offset >= state.source.length)
      return failRich(
        {
          diagnostic: {
            kind: "expected",
            span: { start: offset, end: offset },
            expected: ["closing quote"],
            message: "Expected closing quote"
          },
          control: { kind: "recoverable", cutGeneration: state.cutGeneration }
        },
        state
      )
    const value = state.source.slice(state.offset + 1, offset)
    if (validStrings.includes(value))
      return replySuccess(
        value,
        State.consume(state, offset - state.offset + 1)
      )
    const hints = generateHints(value, validStrings)
    const diagnostic: Diagnostic = {
      kind: "unexpected",
      span: { start: state.offset, end: offset + 1 },
      found: JSON.stringify(sanitizeText(value)),
      ...(hints.length
        ? { hints: hints.map(hint => JSON.stringify(hint)) }
        : {})
    }
    return failRich(
      {
        diagnostic,
        control: { kind: "recoverable", cutGeneration: state.cutGeneration }
      },
      state
    )
  })
}
