# API Reference

Complete API reference for Parserator, organized by module.

## Module Overview

| Module                                  | Description                               |
| --------------------------------------- | ----------------------------------------- |
| [Parser](/api/parser)                   | Core `Parser<T>` class and methods        |
| [Combinators](/api/combinators)         | All standard combinators                  |
| [Optimized](/api/optimized)             | Performance-optimized combinators         |
| [Fast Path](/api/fastpath)              | `MutableParserContext` and pooling        |
| [State](/api/state)                     | `ParserState` and utilities               |
| [Errors](/api/errors)                   | `ParseError` types and `ParseErrorBundle` |
| [Error Formatter](/api/error-formatter) | Formatting errors for output              |
| [Hints](/api/hints)                     | Typo suggestions and keyword hints        |
| [Either](/api/either)                   | `Either` monad for results                |

## Quick Reference

Most commonly used exports:

```typescript
import {
  // Core
  Parser,
  parser,

  // Basic combinators
  char,
  string,
  regex,
  digit,
  alphabet,

  // Repetition
  many,
  many1,
  sepBy,

  // Alternatives
  or,
  optional,

  // Structure
  between,
  sequence,

  // Control
  commit,
  atomic,
  eof,

  // Error handling
  Either,
  ErrorFormatter,
  ParseErrorBundle,

  // Optimized
  manyDigit,
  skipWhitespace,
  oneOfChars,
  anyOfStrings
} from "parserator";
```

## Import Patterns

Everything from one import:

```typescript
import { parser, char, many1, digit } from "parserator";
```

## Type Exports

Key types for TypeScript users:

```typescript
import type {
  Parser,
  ParserState,
  ParserOutput,
  ParseError,
  ParseErrorBundle,
  Either,
  Span
} from "parserator";
```

## Next Steps

- Explore the [Core Parser](/api/parser) class
- Browse all [Combinators](/api/combinators)
- Learn about [Error Handling](/api/errors)
