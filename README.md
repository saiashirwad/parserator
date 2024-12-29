# Parserator

> **Warning**
> This library is currently in early development and the API is subject to change. There are *several* bugs. Please don't use, even at your own risk. I am absolutely responsible for any bugs, so holler at me at [@texoport.in](https://bsky.app/profile/texoport.in).

A TypeScript parser combinator library inspired by [Parsec](https://github.com/haskell/parsec) and [Effect-TS](https://github.com/Effect-ts/Effect). Write parsers using a clean, generator-based syntax or compose them using functional combinators.

## Features

* 🎯 **Generator Syntax**: Write parsers using a clean, async-like syntax
* 🔧 **Functional Combinators**: Compose parsers using functional programming patterns
* 🎭 **Type-Safe**: Full TypeScript support with precise type inference
* 📦 **Zero Dependencies**: No external dependencies, just pure TypeScript
* 🐛 **Great Error Messages**: Helpful error messages with source positions

## Installation

```bash
npm install parserator
```

## Quick Start

### Generator Syntax

Write parsers using a clean, generator-based syntax that feels like async/await:

```typescript
import { Parser, char } from 'parserator'

const parser = new Parser(function* () {
  const a = yield* char("a")
  const b = yield* char("b")
  return { a, b }
})

parser.run("ab") // Right([{ a: "a", b: "b" }, ...])
parser.run("ac") // Left(ParserError: Expected 'b' but found 'c')
```

### Functional Combinators

Or use functional combinators for more complex parsing:

```typescript
import { char, many1, sepBy, between } from 'parserator'

// Parse a comma-separated list of 'a's between parentheses: (a,a,a)
const listParser = between(
  char("("),
  char(")"),
  sepBy(char(","), char("a"))
)

listParser.run("(a,a,a)") // Right([["a", "a", "a"], ...])
```
