import { ParseErrorBundle, type ParseError, type Span } from "./errors";

/**
 * Unique symbol used as a sentinel value to indicate parse failure in fast-path mode.
 * This avoids allocating Either objects on every parser operation.
 */
export const PARSE_FAILED = Symbol("PARSE_FAILED");

/**
 * Type for fast-path parser results.
 * Returns either the parsed value T, or PARSE_FAILED sentinel.
 */
export type FastPathResult<T> = T | typeof PARSE_FAILED;

/**
 * Mutable context used during fast-path parsing.
 * Instead of creating new immutable state objects, we mutate this context in-place.
 * This dramatically reduces allocations and improves performance.
 */
export class MutableParserContext {
  /** The complete original input string */
  source: string;

  /** Current byte offset from start of input (0-indexed) */
  offset: number;

  /** Current line number (1-indexed) - computed lazily on error */
  line: number;

  /** Current column number (1-indexed) - computed lazily on error */
  column: number;

  /** Whether the parser has committed to this parse path (affects backtracking) */
  committed: boolean;

  /** Stack of parsing context labels for error reporting */
  labelStack: string[];

  /** The furthest error encountered during parsing (null if no error yet) */
  error: ParseError | null;

  /** Offset where the error occurred */
  errorOffset: number;

  /** Custom error message from .expect() */
  expectMessage: string | null;

  constructor(source: string) {
    this.source = source;
    this.offset = 0;
    this.line = 1;
    this.column = 1;
    this.committed = false;
    this.labelStack = [];
    this.error = null;
    this.errorOffset = -1;
    this.expectMessage = null;
  }

  /**
   * Gets the character at current offset without allocating.
   */
  charAt(): string {
    return this.source[this.offset] || "";
  }

  /**
   * Checks if remaining input starts with the given string.
   */
  startsWith(str: string): boolean {
    return this.source.startsWith(str, this.offset);
  }

  /**
   * Gets the remaining unparsed portion of the input.
   * WARNING: Allocates a new string. Prefer charAt() or startsWith().
   */
  remaining(): string {
    return this.source.slice(this.offset);
  }

  /**
   * Checks if at end of input.
   */
  isAtEnd(): boolean {
    return this.offset >= this.source.length;
  }

  /**
   * Advances the offset by n characters.
   * Does NOT update line/column (computed lazily on error).
   */
  advance(n: number): void {
    this.offset += n;
  }

  /**
   * Records an error if it's further than any previous error.
   * This implements "furthest failure" error reporting.
   */
  recordError(error: ParseError): void {
    if (this.offset > this.errorOffset) {
      this.error = error;
      this.errorOffset = this.offset;
      this.expectMessage = null; // Clear any previous expect message
    }
  }

  /**
   * Records an expect message at the current offset.
   */
  recordExpect(message: string): void {
    if (this.offset >= this.errorOffset) {
      this.expectMessage = message;
      this.errorOffset = this.offset;
    }
  }

  /**
   * Computes the actual line and column for the current offset.
   * This is expensive (O(offset)) so only call when creating errors.
   */
  computePosition(): void {
    let line = 1;
    let column = 1;

    for (let i = 0; i < this.offset; i++) {
      if (this.source[i] === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
    }

    this.line = line;
    this.column = column;
  }

  span(length: number = 0): Span {
    return {
      offset: this.offset,
      length,
      line: this.line,
      column: this.column
    };
  }

  snapshot(): ContextSnapshot {
    return {
      offset: this.offset,
      line: this.line,
      column: this.column,
      committed: this.committed,
      labelStackLength: this.labelStack.length,
      error: this.error,
      errorOffset: this.errorOffset,
      expectMessage: this.expectMessage
    };
  }

  /**
   * Restores context to a previous snapshot (for backtracking).
   */
  restore(snapshot: ContextSnapshot): void {
    this.offset = snapshot.offset;
    this.line = snapshot.line;
    this.column = snapshot.column;
    this.committed = snapshot.committed;
    this.labelStack.length = snapshot.labelStackLength;
    this.error = snapshot.error;
    this.errorOffset = snapshot.errorOffset;
    this.expectMessage = snapshot.expectMessage;
  }

  /**
   * Converts the current error to a ParseErrorBundle.
   * Computes line/column if not already computed.
   */
  toErrorBundle(): ParseErrorBundle {
    if (!this.error) {
      throw new Error("No error to convert to bundle");
    }

    if (this.line === 1 && this.column === 1 && this.offset > 0) {
      this.computePosition();
    }

    return new ParseErrorBundle([this.error], this.source);
  }
}

/**
 * Snapshot of context state for backtracking.
 */
export type ContextSnapshot = {
  offset: number;
  line: number;
  column: number;
  committed: boolean;
  labelStackLength: number;
  error: ParseError | null;
  errorOffset: number;
  expectMessage: string | null;
};

/**
 * Interface for parsers that support fast-path execution.
 * Parsers can implement this to opt into the mutable execution model.
 */
export interface FastPathParser<T> {
  /**
   * Runs the parser in fast-path mode with a mutable context.
   * Returns the parsed value T on success, or PARSE_FAILED on failure.
   * Errors are recorded in the context.
   */
  runFast(ctx: MutableParserContext): FastPathResult<T>;
}

/**
 * Type guard to check if a parser supports fast-path execution.
 */
export function isFastPathParser<T>(parser: any): parser is FastPathParser<T> {
  return parser && typeof parser.runFast === "function";
}
