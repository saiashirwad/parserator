# Parserator

> **Warning**
> This library is currently in early development and the API is subject to change. There are *several* bugs. Please don't use, even at your own risk. I am absolutely responsible for any bugs, so holler at me at [@texoport.in](https://bsky.app/profile/texoport.in).

A TypeScript parser combinator library inspired by [Parsec](https://github.com/haskell/parsec) and [Effect-TS](https://github.com/Effect-ts/Effect). Write parsers using a clean, generator-based syntax or compose them using functional combinators.

## Features

* 🎯 **Generator Syntax**: Write parsers using a clean, async-like syntax
* 🔧 **Functional Combinators**: Compose parsers using functional programming patterns
* 🎭 **Type-Safe**: Full TypeScript support with precise type inference
* 🚀 **Fast**: Built for performance with minimal overhead
* 📦 **Zero Dependencies**: Just TypeScript, nothing else
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

### Error Handling

Get detailed error messages with source positions:

```typescript
import { Parser, char, string } from 'parserator'

const keyword = string("let")
const parser = new Parser(function* () {
  yield* keyword
  yield* char(" ")
  return "parsed let"
})

parser.run("lett") 
// Left(ParserError: Expected 'let' but found 'lett' at line 1, column 1)
```

### Building Complex Parsers

Combine parsers to build more complex ones:

```typescript
import { Parser, char, digit, many1, or } from 'parserator'

// Parse integers or floating point numbers
const number = new Parser(function* () {
  const digits = yield* many1(digit)
  const hasDecimal = yield* or(char("."), Parser.pure(null))
  
  if (!hasDecimal) {
    return Number(digits.join(""))
  }
  
  const decimals = yield* many1(digit)
  return Number(digits.join("") + "." + decimals.join(""))
})

number.run("123")    // Right([123, ...])
number.run("123.45") // Right([123.45, ...])
```

### Lexer Support

Built-in lexer support for tokenization:

```typescript
import { Parser, string, many1, alphabet } from 'parserator'

const identifier = many1(alphabet)
const keyword = string("let")

const lexer = new Parser(function* () {
  const tokens = []
  while (!isAtEnd()) {
    // Skip whitespace
    yield* skipMany0(char(" "))
    
    // Try keyword first
    const token = yield* or(
      keyword.map(() => ({ type: "keyword" as const })),
      identifier.map(id => ({ type: "identifier" as const, value: id.join("") }))
    )
    tokens.push(token)
  }
  return tokens
})

lexer.run("let foo") 
// Right([[{ type: "keyword" }, { type: "identifier", value: "foo" }], ...])
```

## Advanced Features

### Custom Error Messages

Customize error messages for better debugging:

```typescript
const parser = char("a").error("Expected the letter 'a'")
```

### Lookahead

Look ahead in the input without consuming it:

```typescript
import { lookAhead, char } from 'parserator'

const parser = new Parser(function* () {
  const next = yield* lookAhead(char("a"))
  if (next) {
    // Found 'a' ahead, but haven't consumed it yet
  }
})
```

### State Management

Maintain state while parsing:

```typescript
import { Parser, char } from 'parserator'

const parser = new Parser(function* () {
  let count = 0
  while (!isAtEnd()) {
    yield* char("a")
    count++
  }
  return count
})
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

MIT
