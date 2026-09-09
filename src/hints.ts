import { isFinal, waitForInput } from "./core.ts"
import type { Diagnostic } from "./errors.ts"
import {
  failRich,
  makeResumable,
  replySuccess,
  runResumable,
  type Parser
} from "./parser.ts"
import type { ParserState } from "./state.ts"
import { State, waitForPoint } from "./state.ts"

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
const identifierPattern = /[A-Za-z_][A-Za-z0-9_']*/uy

function identifierAt(state: ParserState): string {
  identifierPattern.lastIndex = state.offset
  const match = identifierPattern.exec(state.source)
  return match?.[0] ?? State.charAt(state)
}

function keywordFailure(
  state: ParserState,
  found: string,
  expected: readonly string[],
  keywords: readonly string[]
): Parser<never> {
  const hints = generateHints(found, keywords)
  const diagnostic: Diagnostic = {
    kind: "expected",
    span: { start: state.offset, end: state.offset + found.length },
    expected: expected.map(value => JSON.stringify(value)),
    ...(found ? { found } : {}),
    ...(hints.length ? { hints } : {})
  }
  return makeResumable(current =>
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

/** Resolve candidate prefixes and the identifier used in failure suggestions. */
function* waitForKeyword(
  state: ParserState,
  keywords: readonly string[]
): Generator<void, void, void> {
  for (const keyword of keywords) {
    let matched = 0
    while (matched < keyword.length) {
      while (state.offset + matched >= state.source.length && !isFinal(state))
        yield* waitForInput(state)
      if (state.source[state.offset + matched] !== keyword[matched]) break
      matched++
    }
    if (matched === keyword.length)
      yield* waitForPoint(state, state.offset + matched)
  }
  yield* waitForPoint(state)
  if (!/[A-Za-z_]/u.test(State.charAt(state))) return
  let end = state.offset
  while (true) {
    yield* waitForPoint(state, end)
    const next = state.source[end]
    if (!next || !identifierChar(next)) return
    end++
  }
}

function keywordParser(
  keyword: string,
  keywords: readonly string[]
): Parser<string> {
  return makeResumable(function* (state) {
    yield* waitForKeyword(state, [keyword])
    if (State.startsWith(state, keyword)) {
      const next = state.source[state.offset + keyword.length] ?? ""
      if (!next || !identifierChar(next))
        return replySuccess(keyword, State.consume(state, keyword.length))
    }
    return yield* runResumable(
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
  return makeResumable(function* (state) {
    yield* waitForKeyword(state, sorted)
    for (const keyword of sorted) {
      if (State.startsWith(state, keyword)) {
        const next = state.source[state.offset + keyword.length] ?? ""
        if (!next || !identifierChar(next))
          return replySuccess(keyword, State.consume(state, keyword.length))
      }
    }
    return yield* runResumable(
      keywordFailure(state, identifierAt(state), sorted, sorted),
      state
    )
  })
}

export function stringWithHints(
  validStrings: readonly string[]
): Parser<string> {
  return makeResumable(function* (state) {
    yield* waitForPoint(state)
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
    while (true) {
      while (offset < state.source.length && state.source[offset] !== '"')
        offset++
      if (offset < state.source.length || isFinal(state)) break
      yield* waitForInput(state)
    }
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
