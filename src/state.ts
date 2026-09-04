import { SourceText, type Failure, type Span } from "./errors.ts"

export type Spanned<T> = { readonly value: T; readonly span: Span }

export type ParserState = {
  readonly source: string
  readonly offset: number
  readonly cutGeneration: number
  /** Context from the last parser wrapped in `context`, used by full-input parsing. */
  readonly completionContext?: readonly string[]
}

export type Success<T> = { readonly ok: true; readonly value: T }
export type FailureResult = { readonly ok: false; readonly failure: Failure }
export type ParserReply<T> = {
  readonly state: ParserState
  readonly result: Success<T> | FailureResult
}
export type Reply<T> = ParserReply<T>
export type ParserOutput<T> = ParserReply<T>

export const ParserOutput = <T>(
  state: ParserState,
  result: Success<T> | FailureResult
): ParserReply<T> => ({ state, result })

export type SourcePosition = {
  readonly line: number
  readonly column: number
  readonly offset: number
}

const advanced = (state: ParserState, offset: number): ParserState => ({
  source: state.source,
  offset,
  cutGeneration: state.cutGeneration,
  ...(state.completionContext
    ? { completionContext: state.completionContext }
    : {})
})

function codePointAt(
  source: string,
  offset: number
): {
  readonly value: string
  readonly width: number
} {
  const first = source.charCodeAt(offset)
  if (Number.isNaN(first)) return { value: "", width: 0 }

  if (first >= 0xd800 && first <= 0xdbff) {
    const second = source.charCodeAt(offset + 1)
    if (second >= 0xdc00 && second <= 0xdfff) {
      return { value: source.slice(offset, offset + 2), width: 2 }
    }
    return { value: "\ufffd", width: 1 }
  }

  if (first >= 0xdc00 && first <= 0xdfff) {
    return { value: "\ufffd", width: 1 }
  }

  return { value: source[offset]!, width: 1 }
}

export const State = {
  fromInput(input: string): ParserState {
    return { source: input, offset: 0, cutGeneration: 0 }
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
    return n === 0 ? state : advanced(state, state.offset + n)
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
    return offset === state.offset ? state : advanced(state, offset)
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
    const source = new SourceText(state.source)
    const position = source.positionAt(state.offset)
    return `line ${position.line}, column ${position.column}, offset ${state.offset}`
  },
  toPosition(state: ParserState): SourcePosition {
    const source = new SourceText(state.source)
    const position = source.positionAt(state.offset)
    return { ...position, offset: state.offset }
  }
}
