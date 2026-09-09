import {
  advanceTo,
  initialState,
  isFinal,
  waitForInput,
  type CoreReply,
  type CoreState
} from "./core.ts"
import { SourceText, type Span } from "./errors.ts"

export type Spanned<T> = { readonly value: T; readonly span: Span }

export type ParserState = CoreState<string>
export type ParserReply<T> = CoreReply<T, string>
export type Reply<T> = ParserReply<T>
export type ParserOutput<T> = ParserReply<T>
export { makeReply as ParserOutput } from "./core.ts"
export type { Success, FailureResult } from "./core.ts"

export type SourcePosition = {
  readonly line: number
  readonly column: number
  readonly offset: number
}

// Keep only the last source so position reads share an index without an
// unbounded cache of completed inputs.
let positionSource: SourceText | undefined

function sourceForPosition(text: string): SourceText {
  if (positionSource?.text !== text) positionSource = new SourceText(text)
  return positionSource
}

/** Returns one Unicode code point and its UTF-16 width; empty at the end. */
export function codePointAt(
  source: string,
  offset: number
): { readonly value: string; readonly width: number } {
  const first = source.charCodeAt(offset)
  if (Number.isNaN(first)) return { value: "", width: 0 }

  if (first >= 0xd800 && first <= 0xdbff) {
    const second = source.charCodeAt(offset + 1)
    if (second >= 0xdc00 && second <= 0xdfff) {
      return { value: source.slice(offset, offset + 2), width: 2 }
    }
    return { value: "�", width: 1 }
  }

  if (first >= 0xdc00 && first <= 0xdfff) {
    return { value: "�", width: 1 }
  }

  return { value: source[offset]!, width: 1 }
}

export const State = {
  fromInput(input: string): ParserState {
    return initialState(input)
  },
  remaining(state: ParserState): string {
    return state.source.slice(state.offset)
  },
  /** Returns one Unicode code point, while offsets remain UTF-16 indices. */
  charAt(state: ParserState): string {
    return codePointAt(state.source, state.offset).value
  },
  charWidthAt(state: ParserState): number {
    return codePointAt(state.source, state.offset).width
  },
  startsWith(state: ParserState, value: string): boolean {
    return state.source.startsWith(value, state.offset)
  },
  consume(state: ParserState, n: number): ParserState {
    if (!Number.isSafeInteger(n) || n < 0)
      throw new RangeError("consume expects a safe nonnegative integer")
    if (n > state.source.length - state.offset)
      throw new RangeError("Cannot consume more input than remains")
    return n === 0 ? state : advanceTo(state, state.offset + n)
  },
  consumeWhile(
    state: ParserState,
    predicate: (char: string) => boolean
  ): ParserState {
    let offset = state.offset
    while (offset < state.source.length) {
      const point = codePointAt(state.source, offset)
      if (!point.value || !predicate(point.value)) break
      offset += point.width
    }
    return offset === state.offset ? state : advanceTo(state, offset)
  },
  peek(state: ParserState, n = 1): string {
    if (!Number.isSafeInteger(n) || n < 0)
      throw new RangeError("peek expects a safe nonnegative integer")
    let result = ""
    let offset = state.offset
    for (let index = 0; index < n && offset < state.source.length; index++) {
      const point = codePointAt(state.source, offset)
      result += point.value
      offset += point.width
    }
    return result
  },
  isAtEnd(state: ParserState): boolean {
    return state.offset >= state.source.length
  },
  printPosition(state: ParserState): string {
    const position = State.toPosition(state)
    return `line ${position.line}, column ${position.column}, offset ${state.offset}`
  },
  toPosition(state: ParserState): SourcePosition {
    const source = sourceForPosition(state.source)
    const position = source.positionAt(state.offset)
    return { ...position, offset: state.offset }
  }
}

/** True when the cursor holds a complete code point, including malformed UTF-16. */
export function hasPoint(state: ParserState, offset = state.offset): boolean {
  const first = state.source.charCodeAt(offset)
  return (
    offset < state.source.length &&
    !(first >= 0xd800 && first <= 0xdbff && offset + 1 === state.source.length)
  )
}

/** A trailing high surrogate may be the first half of the next code point. */
export function* waitForPoint(
  state: ParserState,
  offset = state.offset
): Generator<void, void, void> {
  while (!isFinal(state) && !hasPoint(state, offset)) yield* waitForInput(state)
}
