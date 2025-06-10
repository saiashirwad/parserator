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
export type ParserOutput<T, Ctx = unknown> = {
  /** The parser state after the operation */
  state: ParserState<Ctx>;
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
export const ParserOutput = <T, Ctx = unknown>(
  state: ParserState<Ctx>,
  result: Either<T, ParseErrorBundle>
): ParserOutput<T, Ctx> => ({
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
 *   remaining: "hello world",
 *   pos: { line: 1, column: 1, offset: 0 },
 *   source: "hello world",
 *   debug: true,
 *   labelStack: ["expression", "identifier"],
 *   committed: false
 * };
 * ```
 */
export type ParserState<Ctx = unknown> = {
  /** The portion of input that hasn't been consumed yet */
  remaining: string;
  /** Current position in the source code */
  pos: SourcePosition;
  /** The complete original input string */
  source: string;
  /** Whether debug mode is enabled for detailed error reporting */
  debug?: boolean;
  /** Stack of parsing context labels for error reporting */
  labelStack?: string[];
  /** Whether the parser has committed to this parse path */
  committed?: boolean;
  /** Additional context information */
  ctx: Ctx;
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
  fromInput<Ctx = unknown>(input: string, ctx?: Ctx): ParserState<Ctx> {
    return {
      remaining: input,
      source: input,
      pos: { line: 1, column: 1, offset: 0 },
      ctx: (ctx ?? {}) as Ctx
    };
  },

  /**
   * Creates a new state by consuming n characters from the current state.
   *
   * @param state - The current parser state
   * @param n - Number of characters to consume
   * @returns A new state with n characters consumed and position updated
   * @throws Error if attempting to consume more characters than remaining
   */
  consume<Ctx = unknown>(state: ParserState<Ctx>, n: number): ParserState<Ctx> {
    if (n === 0) return state;
    if (n > state.remaining.length) {
      throw new Error("Cannot consume more characters than remaining");
    }

    const consumed = state.remaining.slice(0, n);
    let { line, column, offset } = state.pos;

    for (const char of consumed) {
      if (char === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
      offset++;
    }

    return {
      ...state,
      remaining: state.remaining.slice(n),
      pos: { line, column, offset }
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
  consumeString<Ctx = unknown>(
    state: ParserState<Ctx>,
    str: string
  ): ParserState<Ctx> {
    if (!state.remaining.startsWith(str)) {
      throw new Error(
        `Cannot consume "${str}" - input "${state.remaining}" doesn't start with it`
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
  moveTo<Ctx = unknown>(
    state: ParserState<Ctx>,
    moveBy: number
  ): ParserState<Ctx> {
    return State.consume(
      {
        ...state,
        remaining: state.source,
        pos: { line: 1, column: 1, offset: 0 }
      },
      state.pos.offset + moveBy
    );
  },

  /**
   * Creates a new state by consuming characters while a predicate is true.
   *
   * @param state - The current parser state
   * @param predicate - Function that tests each character
   * @returns A new state with matching characters consumed
   */
  consumeWhile<Ctx = unknown>(
    state: ParserState<Ctx>,
    predicate: (char: string) => boolean
  ): ParserState<Ctx> {
    let i = 0;
    while (i < state.remaining.length && predicate(state.remaining[i])) {
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
  peek<Ctx = unknown>(state: ParserState<Ctx>, n: number = 1): string {
    return state.remaining.slice(0, n);
  },

  /**
   * Checks if the parser has reached the end of input.
   *
   * @param state - The current parser state
   * @returns True if at end of input, false otherwise
   */
  isAtEnd<Ctx = unknown>(state: ParserState<Ctx>): boolean {
    return state.remaining.length === 0;
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
  printPosition<Ctx = unknown>(state: ParserState<Ctx>): string {
    return `line ${state.pos.line}, column ${state.pos.column}, offset ${state.pos.offset}`;
  }
};
