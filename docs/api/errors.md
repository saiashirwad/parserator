# Errors

API reference for error types, position tracking, and error aggregation in Parserator.

## ParseError Types

`ParseError` is a union of four specific error types, distinguished by their `tag` property.

```typescript
type ParseError =
  | ExpectedParseError
  | UnexpectedParseError
  | CustomParseError
  | FatalParseError;
```

### ExpectedParseError

Occurs when the parser expected specific inputs but found something else.

```typescript
type ExpectedParseError = {
  tag: "Expected";
  span: Span;
  items: string[];
  context: string[];
  found?: string;
};
```

### UnexpectedParseError

Occurs when the parser encounters a token that is explicitly disallowed or structurally invalid.

```typescript
type UnexpectedParseError = {
  tag: "Unexpected";
  span: Span;
  found: string;
  context: string[];
  hints?: string[];
};
```

### CustomParseError

A user-defined error created via `.flatMap` or custom parser logic.

```typescript
type CustomParseError = {
  tag: "Custom";
  span: Span;
  message: string;
  context: string[];
  hints?: string[];
};
```

### FatalParseError

An unrecoverable error that bypasses backtracking in `or()` or `optional()`.

```typescript
type FatalParseError = {
  tag: "Fatal";
  span: Span;
  message: string;
  context: string[];
};
```

---

## Span Type

Represents a range in the source code.

```typescript
type Span = {
  offset: number;
  length: number;
  line: number;
  column: number;
};
```

### Span Factory

Creates a `Span` from the current parser state.

```typescript
function Span(state: ParserState, length?: number): Span;
```

---

## ParseErrorBundle

A collection of errors produced during a parse operation. It provides utilities for identifying the most relevant error and formatting it for display.

```typescript
class ParseErrorBundle {
  errors: ParseError[];
  source: string;

  /** The error that occurred furthest in the input. */
  get primary(): ParseError;

  /** All errors that occurred at the same furthest position. */
  get primaryErrors(): ParseError[];

  /** Returns a simple string representation of the primary error. */
  toString(): string;

  /**
   * Formats the bundle using a specific formatter.
   * Supports "plain", "ansi", "html", and "json".
   */
  format(format: "plain" | "ansi" | "html" | "json"): string;
}
```

---

## ParseError Factory

Convenience methods for creating `ParseError` objects with the correct tags.

```typescript
const ParseError = {
  expected(opts: { span: Span, items: string[], context: string[], found?: string }): ExpectedParseError,
  unexpected(opts: { span: Span, found: string, context: string[], hints?: string[] }): UnexpectedParseError,
  custom(opts: { span: Span, message: string, context: string[], hints?: string[] }): CustomParseError,
  fatal(opts: { span: Span, message: string, context: string[] }): FatalParseError
};
```
