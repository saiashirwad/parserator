# Parserator Documentation

Parserator is a modern, type-safe parser combinator library for TypeScript that provides expressive parsing capabilities with excellent error reporting and debugging features.

## Quick Start

```typescript
import { char, many1, digit, string, or, Parser } from 'parserator'

// Parse a simple number
const number = many1(digit).map(digits => parseInt(digits.join('')))

// Parse a greeting
const greeting = string('Hello').then(char(' ')).then(string('World'))

// Parse either a number or a greeting
const parser = or(number, greeting)

const result = parser.parseOrThrow('123') // Returns: 123
```

## Table of Contents

### Getting Started
- [Installation](./getting-started/installation.md)
- [Your First Parser](./getting-started/first-parser.md)
- [Core Concepts](./getting-started/core-concepts.md)

### API Reference
- [Parser Class](./api/parser.md)
- [Basic Combinators](./api/combinators.md)
- [String Parsers](./api/string-parsers.md)
- [Repetition Combinators](./api/repetition.md)
- [Error Handling](./api/error-handling.md)
- [Debug Utilities](./api/debug.md)

### Advanced Topics
- [Generator Syntax](./advanced/generator-syntax.md)
- [Error Formatting](./advanced/error-formatting.md)
- [Context and State](./advanced/context-state.md)
- [Hint System](./advanced/hints.md)
- [Performance Tips](./advanced/performance.md)
- [Recursive Parsers](./advanced/recursive-parsers.md)

### Examples
- [JSON Parser](./examples/json-parser.md)
- [INI File Parser](./examples/ini-parser.md)
- [Scheme/Lisp Parser](./examples/scheme-parser.md)
- [Calculator](./examples/calculator.md)
- [CSV Parser](./examples/csv-parser.md)

### Guides
- [Migration from Other Libraries](./guides/migration.md)
- [Best Practices](./guides/best-practices.md)
- [Testing Parsers](./guides/testing.md)
- [Error Recovery Strategies](./guides/error-recovery.md)

### Reference
- [Complete API](./reference/api.md)
- [Error Types](./reference/errors.md)
- [Type Definitions](./reference/types.md)
- [Changelog](./reference/changelog.md)

## Key Features

### 🔧 **Modern TypeScript**
- Full type safety with excellent inference
- Generator syntax support for readable parser composition
- Zero runtime dependencies

### 🎯 **Expressive Combinators**
- Rich set of parser combinators
- Intuitive method chaining
- Support for both functional and object-oriented styles

### 🚨 **Rich Error Reporting**
- Detailed error messages with context
- Multiple output formats (plain, ANSI, HTML, JSON)
- Smart hint system for common mistakes

### 🐛 **Debugging Support**
- Built-in debug utilities
- State inspection tools
- Performance benchmarking

### 📚 **Comprehensive Examples**
- Real-world parser examples
- Step-by-step tutorials
- Best practice demonstrations

## Community

- **GitHub**: [parserator repository](https://github.com/your-org/parserator)
- **Issues**: Report bugs and request features
- **Discussions**: Ask questions and share examples

## License

MIT License - see [LICENSE](../LICENSE) file for details.