# API Reference

This section provides comprehensive documentation for all Parserator APIs, including classes, functions, types, and utilities.

## Core Classes

### [`Parser<T, Ctx>`](./parser.md)

The main parser class that represents a computation that can consume input and produce a value of type `T`.

```typescript
import { Parser } from "parserator";

const myParser = new Parser(state => {
  // parsing logic
});
```

**Key Methods:**

- `parse(input)` - Parse input and return result with state
- `parseOrThrow(input)` - Parse or throw on failure
- `map(fn)` - Transform parser result
- `flatMap(fn)` - Chain dependent parsers
- `zip(other)` - Combine two parsers into a tuple
- `then(other)` - Sequence parsers, keep second result
- `thenDiscard(other)` - Sequence parsers, keep first result

## Core Functions

### [Combinators](./combinators.md)

Functions that create and combine parsers.

#### Basic Parsers

```typescript
import { char, string, regex, digit, alphabet } from "parserator";

char("a"); // Parse single character
string("hello"); // Parse exact string
regex(/\d+/); // Parse regex pattern
digit; // Parse any digit
alphabet; // Parse any letter
```

#### Choice Combinators

```typescript
import { or, optional } from "parserator";

or(parser1, parser2, parser3); // Try parsers in order
optional(parser); // Make parser optional
```

#### Repetition Combinators

```typescript
import { many0, many1, manyN, sepBy } from "parserator";

many0(parser); // Zero or more
many1(parser); // One or more
manyN(parser, 3); // At least 3
sepBy(comma, parser); // Separated list
```

#### Sequence Combinators

```typescript
import { sequence, between } from "parserator";

sequence([p1, p2, p3]); // Run in sequence
between(open, close, content); // Parse between delimiters
```

### [String Parsers](./string-parsers.md)

Specialized parsers for text processing.

```typescript
import { takeUntil, takeUpto, parseUntilChar } from "parserator";

takeUntil(terminator); // Consume until terminator found
takeUpto(boundary); // Consume up to boundary
parseUntilChar("\n"); // Consume until specific character
```

### [Debug Utilities](./debug.md)

Tools for debugging and introspecting parser behavior.

```typescript
import { debug, trace, benchmark } from "parserator";

debug(parser, "label"); // Add debug output
trace("checkpoint"); // Add trace point
benchmark(parser, "timing"); // Measure performance
```

## Error Handling

### [Error Management](./error-handling.md)

Comprehensive error handling and reporting.

```typescript
import { ErrorFormatter, formatError } from "parserator";

// Format errors for display
const formatter = new ErrorFormatter("ansi");
const message = formatter.format(errorBundle);

// Convenience formatters
formatError.plain(bundle);
formatError.ansi(bundle);
formatError.html(bundle);
formatError.json(bundle);
```

### Error Types

```typescript
// Rich error information
interface ParseErrorBundle {
  errors: ParseErr[];
  source: string;
  primary: ParseErr;
}

type ParseErr =
  | { tag: "Expected"; items: string[] }
  | { tag: "Unexpected"; found: string }
  | { tag: "Custom"; message: string; hints?: string[] };
```

## Advanced Features

### [Generator Syntax](../advanced/generator-syntax.md)

Imperative-style parser composition using JavaScript generators.

```typescript
const parser = Parser.gen(function* () {
  const name = yield* identifier;
  yield* char("=");
  const value = yield* expression;
  return { name, value };
});
```

### [Hint System](../advanced/hints.md)

Smart suggestions for common parsing errors.

```typescript
import { keywordWithHints, generateHints } from "parserator";

const keywords = ["function", "const", "let", "var"];
const keywordParser = keywordWithHints(keywords);

// Generates helpful "Did you mean..." suggestions
```

### Context Support

Add custom context to parsing state.

```typescript
interface MyContext {
  debug: boolean;
  variables: Map<string, any>;
}

const parser: Parser<string, MyContext> = Parser.gen(function* () {
  // Access context through state
  const state = yield* peekState;
  if (state.context.debug) {
    console.log("Debug mode enabled");
  }
  return yield* someParser;
});
```

## Utility Types

### Core Types

```typescript
// Parser state and position
interface ParserState<Ctx> {
  remaining: string;
  pos: SourcePosition;
  context: ParserContext<Ctx>;
}

interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

// Parser result
type ParserOutput<T, Ctx> = { state: ParserState<Ctx>; result: Either<T, ParseErrorBundle> };

// Either type for success/failure
type Either<R, L> = Left<L> | Right<R>;
```

### Helper Types

```typescript
// Type utilities
type Prettify<T> = { [K in keyof T]: T[K] } & {};
type Last<T> = T extends [...any[], infer L] ? L : never;

// Parser context
type ParserContext<Ctx = {}> = Ctx & { debug?: boolean; source: string; labelStack?: string[] };
```

## Quick Reference

### Common Patterns

#### Parse Numbers

```typescript
const integer = many1(digit).map(d => parseInt(d.join("")));
const decimal = regex(/\d+\.\d+/).map(parseFloat);
const scientific = regex(/\d+(\.\d+)?[eE][+-]?\d+/).map(parseFloat);
```

#### Parse Strings

```typescript
const quoted = between(char('"'), char('"'), many0(stringChar));
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/);
const whitespace = regex(/\s*/);
```

#### Parse Lists

```typescript
const csvRow = sepBy(char(","), quoted);
const jsonArray = between(char("["), char("]"), sepBy(char(","), jsonValue));
```

#### Error Handling

```typescript
const robustParser = parser.withError(() => "Expected valid input").label("my-parser");
```

### Performance Tips

1. **Reuse parsers**: Create once, use many times
2. **Order alternatives**: Put common/longer matches first in `or`
3. **Use specific parsers**: `char('a')` is faster than `regex(/a/)`
4. **Avoid infinite loops**: Ensure parsers advance on success
5. **Handle whitespace explicitly**: Don't rely on automatic trimming

### Testing Checklist

- [ ] Test successful parsing cases
- [ ] Test failure cases with meaningful errors
- [ ] Test edge cases (empty input, very long input)
- [ ] Test error message quality
- [ ] Performance test for large inputs
- [ ] Test with malformed input

## Migration Guides

### From Other Libraries

- **From Parsimmon**: See [migration guide](../guides/migration.md)
- **From Chevrotain**: See [migration guide](../guides/migration.md)
- **From ANTLR**: See [migration guide](../guides/migration.md)

### Version Updates

- **v1.x to v2.x**: See [changelog](../reference/changelog.md)
- **Breaking changes**: See [migration guide](../guides/migration.md)

## See Also

- [Getting Started](../getting-started/) - Basic concepts and tutorials
- [Examples](../examples/) - Complete real-world examples
- [Advanced Topics](../advanced/) - Deep dives into specific features
- [Best Practices](../guides/best-practices.md) - Guidelines for effective parsing
