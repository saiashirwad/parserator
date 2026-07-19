import type { Either } from "./either.ts"
import { type ParseErrorBundle, positionAt, type Span } from "./errors.ts"

export type Spanned<T> = [value: T, span: Span]

/**
 * Represents the output of a parser operation, containing both the updated state
 * and the parsing result (either success or error).
 * @template T - The type of the successfully parsed value
 */
export type ParserOutput<T> = {
  /** The parser state after the operation */
  state: ParserState
  /** Either a successful result of type T or a ParseErrorBundle */
  result: Either<T, ParseErrorBundle>
}

/**
 * Factory function for creating ParserOutput objects.
 * @template T - The type of the successfully parsed value
 * @param state - The parser state after the operation
 * @param result - Either a successful result or error bundle
 * @returns A new ParserOutput object
 */
export const ParserOutput = <T>(
  state: ParserState,
  result: Either<T, ParseErrorBundle>
): ParserOutput<T> => ({
  state,
  result
})

/**
 * Represents a position within source code with line, column, and byte offset.
 * Line and column are 1-indexed for human readability.
 */
export type SourcePosition = {
  /** Line number (1-indexed) */
  line: number
  /** Column number (1-indexed) */
  column: number
  /** Byte offset from start of input (0-indexed) */
  offset: number
}

/**
 * Represents the complete state of a parser at any point during parsing.
 * Contains the input being parsed, current position, and optional context information.
 *
 * Note: line/column are not tracked here — they are derived lazily from
 * (source, offset) only when an error is displayed. This keeps advancing
 * the parser O(1) instead of O(n) per consumed character.
 */
export type ParserState = {
  /** The complete original input string */
  source: string
  /** Current byte offset from start of input (0-indexed) */
  offset: number
  /** Stack of parsing context labels for error reporting */
  labelStack?: string[] | undefined
  /** Whether the parser has committed to this parse path */
  committed?: boolean | undefined
}

/**
 * Creates a new state at the given offset, preserving source and context.
 * Prefer this over object spread in hot paths — it creates a single
 * consistent hidden class for all parser states.
 */
const advanced = (state: ParserState, offset: number): ParserState => ({
  source: state.source,
  offset,
  labelStack: state.labelStack,
  committed: state.committed
})

/**
 * Utility object containing static methods for creating and manipulating parser state.
 */
export const State = {
  /**
   * Creates a new parser state from an input string.
   *
   * @param input - The input string to parse
   * @returns A new parser state initialized at the start of the input
   */
  fromInput(input: string): ParserState {
    return {
      source: input,
      offset: 0,
      labelStack: undefined,
      committed: undefined
    }
  },

  /**
   * Gets the remaining unparsed portion of the input.
   * Note: this allocates a new string. Prefer peek() or charAt() in hot code.
   *
   * @param state - The current parser state
   * @returns The remaining input string from current offset
   */
  remaining(state: ParserState): string {
    return state.source.slice(state.offset)
  },

  /**
   * Gets the character at the current offset.
   *
   * @param state - The current parser state
   * @returns The character at current offset, or empty string if at end
   */
  charAt(state: ParserState): string {
    return state.source[state.offset] || ""
  },

  /**
   * Checks if remaining input starts with the given string.
   *
   * @param state - The current parser state
   * @param str - The string to check for
   * @returns True if remaining input starts with str
   */
  startsWith(state: ParserState, str: string): boolean {
    return state.source.startsWith(str, state.offset)
  },

  /**
   * Creates a new state by consuming n characters from the current state.
   *
   * @param state - The current parser state
   * @param n - Number of characters to consume
   * @returns A new state with n characters consumed
   * @throws Error if attempting to consume more characters than remaining
   */
  consume(state: ParserState, n: number): ParserState {
    if (n === 0) return state
    if (n > state.source.length - state.offset) {
      throw new Error("Cannot consume more characters than remaining")
    }
    return advanced(state, state.offset + n)
  },

  /**
   * Creates a new state by consuming characters while a predicate is true.
   *
   * @param state - The current parser state
   * @param predicate - Function that tests each character
   * @returns A new state with matching characters consumed
   */
  consumeWhile(
    state: ParserState,
    predicate: (char: string) => boolean
  ): ParserState {
    const source = state.source
    const length = source.length
    let end = state.offset
    while (end < length && predicate(source.charAt(end))) {
      end++
    }
    if (end === state.offset) return state
    return advanced(state, end)
  },

  /**
   * Gets the next n characters from the input without consuming them.
   *
   * @param state - The current parser state
   * @param n - Number of characters to peek (default: 1)
   * @returns The next n characters as a string
   */
  peek(state: ParserState, n: number = 1): string {
    return state.source.slice(state.offset, state.offset + n)
  },

  /**
   * Checks if the parser has reached the end of input.
   *
   * @param state - The current parser state
   * @returns True if at end of input, false otherwise
   */
  isAtEnd(state: ParserState): boolean {
    return state.offset >= state.source.length
  },

  /**
   * Creates a human-readable string representation of the current parser position.
   *
   * @param state - The current parser state
   * @returns A formatted string showing line, column, and offset
   */
  printPosition(state: ParserState): string {
    const { line, column } = positionAt(state.source, state.offset)
    return `line ${line}, column ${column}, offset ${state.offset}`
  },

  /**
   * Creates a SourcePosition from the current parser state.
   * Line and column are computed on demand from the source.
   *
   * @param state - The current parser state
   * @returns A SourcePosition object
   */
  toPosition(state: ParserState): SourcePosition {
    const { line, column } = positionAt(state.source, state.offset)
    return {
      line,
      column,
      offset: state.offset
    }
  }
}
