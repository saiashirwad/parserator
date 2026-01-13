import type { Either } from "./either";
import type { ParseErrorBundle, Span } from "./errors";

export type Spanned<T> = [value: T, span: Span];

/**
 * Represents the output of a parser operation, containing both the updated state
 * and the parsing result (either success or error).
 * @template T - The type of the successfully parsed value
 * @example
 * ```typescript
 * const output: ParserOutput<string> = {
 *   state: newState,
 *   result: Either.right("parsed value")
 * };
 * ```
 */
export type ParserOutput<T> = {
  /** The parser state after the operation */
  state: ParserState;
  /** Either a successful result of type T or a ParseErrorBundle */
  result: Either<T, ParseErrorBundle>;
};

/**
 * Factory function for creating ParserOutput objects.
 * @template T - The type of the successfully parsed value
 * @param state - The parser state after the operation
 * @param result - Either a successful result or error bundle
 * @returns A new ParserOutput object
 * @example
 * ```typescript
 * import { Either } from "./either";
 *
 * const successOutput = ParserOutput(newState, Either.right("success"));
 * const errorOutput = ParserOutput(oldState, Either.left(errorBundle));
 * ```
 */
export const ParserOutput = <T>(
  state: ParserState,
  result: Either<T, ParseErrorBundle>
): ParserOutput<T> => ({
  state,
  result
});

/**
 * Represents a position within source code with line, column, and byte offset.
 * All values are 1-indexed for human readability.
 * @example
 * ```typescript
 * const position: SourcePosition = {
 *   line: 3,      // Third line
 *   column: 15,   // 15th character on that line
 *   offset: 42    // 42nd character from start of input
 * };
 * ```
 */
export type SourcePosition = {
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** Byte offset from start of input (0-indexed) */
  offset: number;
};

/**
 * Represents the complete state of a parser at any point during parsing.
 * Contains the input being parsed, current position, and optional debugging/context information.
 * @example
 * ```typescript
 * const state: ParserState = {
 *   source: "hello world",
 *   offset: 0,
 *   line: 1,
 *   column: 1,
 *   debug: true,
 *   labelStack: ["expression", "identifier"],
 *   committed: false
 * };
 * ```
 */
export type ParserState = {
  /** The complete original input string */
  source: string;
  /** Current byte offset from start of input (0-indexed) */
  offset: number;
  /** Current line number (1-indexed) */
  line: number;
  /** Current column number (1-indexed) */
  column: number;
  /** Whether debug mode is enabled for detailed error reporting */
  debug?: boolean;
  /** Stack of parsing context labels for error reporting */
  labelStack?: string[];
  /** Whether the parser has committed to this parse path */
  committed?: boolean;
};

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
      line: 1,
      column: 1
    };
  },

  /**
   * Gets the remaining unparsed portion of the input.
   * WARNING: This allocates a new string. Prefer peek() or charAt() for better performance.
   *
   * @param state - The current parser state
   * @returns The remaining input string from current offset
   */
  remaining(state: ParserState): string {
    return state.source.slice(state.offset);
  },

  /**
   * Gets the character at the current offset without allocating.
   *
   * @param state - The current parser state
   * @returns The character at current offset, or empty string if at end
   */
  charAt(state: ParserState): string {
    return state.source[state.offset] || "";
  },

  /**
   * Checks if remaining input starts with the given string, without allocating.
   *
   * @param state - The current parser state
   * @param str - The string to check for
   * @returns True if remaining input starts with str
   */
  startsWith(state: ParserState, str: string): boolean {
    return state.source.startsWith(str, state.offset);
  },

  /**
   * Creates a new state by consuming n characters from the current state.
   *
   * @param state - The current parser state
   * @param n - Number of characters to consume
   * @returns A new state with n characters consumed and position updated
   * @throws Error if attempting to consume more characters than remaining
   */
  consume(state: ParserState, n: number): ParserState {
    if (n === 0) return state;
    const remainingLength = state.source.length - state.offset;
    if (n > remainingLength) {
      throw new Error("Cannot consume more characters than remaining");
    }

    // Fast path: just increment offset, don't compute line/column
    // Line/column will be computed lazily when needed (on error)
    return {
      ...state,
      offset: state.offset + n,
      line: state.line, // Keep old values, will recompute if needed
      column: state.column
    };
  },

  /**
   * Computes the actual line and column for a given offset.
   * This is expensive (O(offset)) so only call when creating errors.
   *
   * @param state - The current parser state
   * @returns Updated state with correct line/column
   */
  computePosition(state: ParserState): ParserState {
    let line = 1;
    let column = 1;

    for (let i = 0; i < state.offset; i++) {
      if (state.source[i] === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
    }

    return {
      ...state,
      line,
      column
    };
  },

  /**
   * Creates a new state by consuming a specific string from the current state.
   *
   * @param state - The current parser state
   * @param str - The string to consume
   * @returns A new state with the string consumed and position updated
   * @throws Error if the input doesn't start with the specified string
   */
  consumeString(state: ParserState, str: string): ParserState {
    const remaining = State.remaining(state);
    if (!remaining.startsWith(str)) {
      throw new Error(
        `Cannot consume "${str}" - input "${remaining}" doesn't start with it`
      );
    }
    return State.consume(state, str.length);
  },

  /**
   * Creates a new state by moving to a specific offset position in the source.
   * Resets to the beginning and then consumes to the target position.
   * @param state - The current parser state
   * @param moveBy - Number of characters to move forward from current position
   * @returns A new state at the target position
   */
  move(state: ParserState, moveBy: number) {
    return State.consume(
      {
        ...state,
        offset: 0,
        line: 1,
        column: 1
      },
      state.offset + moveBy
    );
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
    const remaining = State.remaining(state);
    let i = 0;
    while (i < remaining.length && predicate(remaining[i])) {
      i++;
    }
    return State.consume(state, i);
  },

  /**
   * Gets the next n characters from the input without consuming them.
   *
   * @param state - The current parser state
   * @param n - Number of characters to peek (default: 1)
   * @returns The next n characters as a string
   */
  peek(state: ParserState, n: number = 1): string {
    return state.source.slice(state.offset, state.offset + n);
  },

  /**
   * Checks if the parser has reached the end of input.
   *
   * @param state - The current parser state
   * @returns True if at end of input, false otherwise
   */
  isAtEnd(state: ParserState): boolean {
    return state.offset >= state.source.length;
  },

  /**
   * Creates a human-readable string representation of the current parser position.
   * @param state - The current parser state
   * @returns A formatted string showing line, column, and offset
   * @example
   * ```typescript
   * const posStr = State.printPosition(state);
   * // Returns: "line 5, column 12, offset 89"
   * ```
   */
  printPosition(state: ParserState): string {
    return `line ${state.line}, column ${state.column}, offset ${state.offset}`;
  },

  /**
   * Creates a SourcePosition from the current parser state.
   * @param state - The current parser state
   * @returns A SourcePosition object
   */
  toPosition(state: ParserState): SourcePosition {
    return {
      line: state.line,
      column: state.column,
      offset: state.offset
    };
  }
};
