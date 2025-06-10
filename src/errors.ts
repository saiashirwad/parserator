/**
 * Represents a location span in source code with position and size information.
 * @example
 * ```typescript
 * const span: Span = {
 *   offset: 10,
 *   length: 5,
 *   line: 2,
 *   column: 3
 * };
 * ```
 */
export type Span = {
  /** Byte offset from the start of the source */
  offset: number;
  /** Length of the span in bytes */
  length: number;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
};

/**
 * Creates a Span from parser state and optional length.
 * @param state - Parser state containing position information
 * @param length - Length of the span (defaults to 0)
 * @returns A new Span object
 * @example
 * ```typescript
 * const state = { pos: { offset: 10, line: 2, column: 3 } };
 * const span = Span(state, 5);
 * // Returns: { offset: 10, length: 5, line: 2, column: 3 }
 * ```
 */
export function Span(
  state: { pos: { offset: number; line: number; column: number } },
  length: number = 0
): Span {
  return {
    offset: state.pos.offset,
    length,
    line: state.pos.line,
    column: state.pos.column
  };
}

type ExpectedParseError = {
  tag: "Expected";
  span: Span;
  items: string[];
  context: string[];
  found?: string;
};

type UnexpectedParseError = {
  tag: "Unexpected";
  span: Span;
  found: string;
  context: string[];
  hints?: string[];
};

type CustomParseError = {
  tag: "Custom";
  span: Span;
  message: string;
  hints?: string[];
  context: string[];
};

type FatalParseError = {
  tag: "Fatal";
  span: Span;
  message: string;
  context: string[];
};

/**
 * Union type representing all possible parsing errors.
 * Each error type has a discriminant tag for pattern matching.
 * @example
 * ```typescript
 * function handleError(error: ParseError) {
 *   switch (error.tag) {
 *     case "Expected":
 *       console.log(`Expected ${error.items.join(" or ")}`);
 *       break;
 *     case "Unexpected":
 *       console.log(`Unexpected ${error.found}`);
 *       break;
 *     // ... handle other cases
 *   }
 * }
 * ```
 */
export type ParseError =
  | CustomParseError
  | ExpectedParseError
  | UnexpectedParseError
  | FatalParseError;

/**
 * Factory functions for creating different types of ParseError objects.
 * Provides a convenient API for constructing errors without manually setting tags.
 * @example
 * ```typescript
 * const span = Span(state);
 *
 * // Create an expected error
 * const expectedError = ParseError.expected({
 *   span,
 *   items: ["identifier", "keyword"],
 *   context: ["function declaration"],
 *   found: "number"
 * });
 *
 * // Create a custom error
 * const customError = ParseError.custom({
 *   span,
 *   message: "Invalid syntax",
 *   context: ["expression"],
 *   hints: ["Try using parentheses"]
 * });
 * ```
 */
export const ParseError = {
  /** Creates an ExpectedParseError for when specific tokens were expected */
  expected: (params: Omit<ExpectedParseError, "tag">): ExpectedParseError => ({
    tag: "Expected",
    ...params
  }),
  /** Creates an UnexpectedParseError for when an unexpected token was found */
  unexpected: (
    params: Omit<UnexpectedParseError, "tag">
  ): UnexpectedParseError => ({
    tag: "Unexpected",
    ...params
  }),
  /** Creates a CustomParseError with a custom message */
  custom: (params: Omit<CustomParseError, "tag">): CustomParseError => ({
    tag: "Custom",
    ...params
  }),
  /** Creates a FatalParseError that cannot be recovered from */
  fatal: (params: Omit<FatalParseError, "tag">): FatalParseError => ({
    tag: "Fatal",
    ...params
  })
};

/**
 * A collection of parsing errors with formatting and analysis capabilities.
 * Automatically determines the primary (furthest) error for reporting.
 * @example
 * ```typescript
 * const errors = [
 *   ParseError.expected({ span: spanAt10, items: ["("], context: [] }),
 *   ParseError.unexpected({ span: spanAt15, found: ")", context: [] })
 * ];
 * const bundle = new ParseErrorBundle(errors, sourceCode);
 *
 * console.log(bundle.toString()); // Shows the furthest error
 * console.log(bundle.format("ansi")); // Formatted with colors
 * ```
 */
export class ParseErrorBundle {
  /**
   * Creates a new ParseErrorBundle.
   * @param errors - Array of parsing errors
   * @param source - The original source code being parsed
   * @returns {ParseErrorBundle} A new ParseErrorBundle instance containing the errors and source
   */
  constructor(
    public errors: ParseError[],
    public source: string
  ) {}

  /**
   * Gets the primary error (the one that occurred furthest in the input).
   * This is typically the most relevant error to show to the user.
   * @returns {ParseError} The error with the highest offset position
   */
  get primary(): ParseError {
    return this.errors.reduce((furthest, current) =>
      current.span.offset > furthest.span.offset ? current : furthest
    );
  }

  /**
   * Gets all errors that occurred at the same position as the primary error.
   * Useful when multiple parse attempts failed at the same location.
   * @returns {ParseError[]} Array of errors at the furthest position
   */
  get primaryErrors(): ParseError[] {
    const maxOffset = this.primary.span.offset;
    return this.errors.filter(err => err.span.offset === maxOffset);
  }

  /**
   * Converts the primary error to a simple string representation.
   * @returns {string} A human-readable error message
   */
  toString(): string {
    const err = this.primary;
    switch (err.tag) {
      case "Expected":
        return `Expected ${err.items.join(" or ")}${err.found ? `, found ${err.found}` : ""}`;
      case "Unexpected":
        return `Unexpected ${err.found}`;
      case "Custom":
        return err.message;
      case "Fatal":
        return `Fatal: ${err.message}`;
    }
  }

  /**
   * Formats the error bundle using the specified formatter.
   * @param format - The output format ("plain", "ansi", "html", or "json")
   * @returns {string} Formatted error message with context and highlighting
   */
  format(format: "plain" | "ansi" | "html" | "json" = "plain"): string {
    const { ErrorFormatter } = require("./error-formatter");
    return new ErrorFormatter(format).format(this);
  }
}
