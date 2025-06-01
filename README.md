# Parserator

⚠️ **Warning**: This library is still in early development and has still got some rough edges. The API will change without notice.

[![npm version](https://badge.fury.io/js/parserator.svg)](https://badge.fury.io/js/parserator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An elegant parser combinators library for Typescript.

## Table of contents

- [Introduction](#introduction)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Primitive Parsers](#primitive-parsers)
- [Combinators](#combinators)
- [Generator Syntax](#generator-syntax)
- [Error Handling](#error-handling)
- [Debugging](#debugging)
- [Advanced Usage](#advanced-usage)

## Introduction

Parserator is a TypeScript-first parser combinator library. It allows you to build complex parsers from simple building blocks, with full type inference and a clean, generator-based syntax.

Some key features:

- Zero dependencies
- Written in TypeScript with complete type inference
- Clean, generator-based syntax similar to async/await
- Rich set of built-in parsers and combinators
- Detailed error reporting
- Extensive debugging capabilities

## Installation

```bash
npm install parserator
```

Requirements:

- TypeScript 4.5+
- `strict` mode enabled in tsconfig

## Basic Usage

```typescript
import { Parser, char, many1, digit } from "parserator"

// Create a simple number parser
const numberParser = many1(digit).map(digits => parseInt(digits.join(""), 10))

// Parse a string
numberParser.parse("123") // => 123

// Handle errors safely
numberParser.safeParse("abc")
// => { success: false, error: ParserError }
```

## Primitive Parsers

```typescript
import { char, string, regex, alphabet, digit } from "parserator"

// Single character
char("a").parse("abc") // => "a"

// Exact string
string("hello").parse("hello world") // => "hello"

// Regular expression
regex(/[0-9]+/).parse("123abc") // => "123"

// Any letter
alphabet.parse("abc") // => "a"

// Any digit
digit.parse("123") // => "1"
```

## Combinators

### Repetition

```typescript
import { many0, many1, manyN } from "parserator"

// Zero or more
many0(digit).parse("123abc") // => ["1","2","3"]

// One or more
many1(digit).parse("123abc") // => ["1","2","3"]

// Exact count
manyN(digit, 2).parse("123") // => ["1","2"]
```

### Sequencing

```typescript
import { sequence, or, between, sepBy } from "parserator"

// Sequence of parsers
sequence([char("a"), char("b")]).parse("abc") // => "b"

// Choice between parsers
or(char("a"), char("b")).parse("abc") // => "a"

// Between delimiters
between(char("("), char(")"), digit).parse("(5)") // => "5"

// Separated values
sepBy(char(","), digit).parse("1,2,3") // => ["1","2","3"]
```

### String Operations

```typescript
import { takeUntil, takeUpto, parseUntilChar } from "parserator"

// Take until parser succeeds
takeUntil(char(";")).parse("hello;world") // => "hello"

// Take until parser would succeed
takeUpto(char(";")).parse("hello;world") // => "hello"

// Parse until character
parseUntilChar(";").parse("hello;world") // => "hello"
```

## Generator Syntax

Write parsers using a clean, generator-based syntax that feels like async/await:

```typescript
import { parser, char, many1, digit, optional } from "parserator"

// Parse a floating point number
const float = parser(function* () {
  // Parse optional sign
  const sign = yield* optional(char("-"))

  // Parse integer part
  const intPart = yield* many1(digit)

  // Parse optional fractional part
  const fractionalPart = yield* optional(
    parser(function* () {
      yield* char(".")
      return yield* many1(digit)
    })
  )

  // Parse optional exponent
  const exponentPart = yield* optional(
    parser(function* () {
      yield* char("e")
      const expSign = yield* optional(char("+") || char("-"))
      const expDigits = yield* many1(digit)
      return (expSign ?? "") + expDigits.join("")
    })
  )

  // Combine parts
  const numStr =
    (sign ?? "") +
    intPart.join("") +
    (fractionalPart ? "." + fractionalPart.join("") : "") +
    (exponentPart ? "e" + exponentPart : "")

  return parseFloat(numStr)
})

float.run("123.456e-7") // Right([1.23456e-5, ...])
```

## Error Handling

Customize error messages and add error callbacks:

```typescript
const parser = many1(digit)
  .error("Expected at least one digit")
  .errorCallback((error, state) => {
    return `Error at ${state.pos.line}:${state.pos.column}: ${error.message}`
  })

parser.run("abc")
// Left(ParserError: Error at 1:1: Expected at least one digit)
```

## Debugging

Debug tools to inspect parser behavior:

```typescript
import { debug, trace } from "parserator"

// Add debug output
const debuggedParser = debug(parser, "number-parser")

// Add trace points
const tracedParser = trace("Before parsing number").then(parser)
```

## Advanced Usage

### JSON Array Parser

```typescript
const jsonArray = parser(function* () {
  yield* char("[")
  yield* skipSpaces

  const items = yield* sepBy(
    char(","),
    parser(function* () {
      yield* skipSpaces
      const value = yield* or(stringParser, numberParser)
      yield* skipSpaces
      return value
    })
  )

  yield* skipSpaces
  yield* char("]")
  return items
})

jsonArray.run('["hello", 123, "world"]')
// Right([["hello", 123, "world"], ...])
```

### Recursive Parsers

```typescript
const expr: Parser<number> = Parser.lazy(() =>
  parser(function* () {
    yield* char("(")
    const left = yield* number
    const op = yield* or(char("+"), char("-"))
    const right = yield* expr
    yield* char(")")

    return op === "+" ? left + right : left - right
  })
)

expr.run("(1+(2-(3+4)))")
// Right([-4, ...])
```

## API Reference

### Parser<T>

The core Parser class that represents a parsing computation.

### Methods

#### run(input: string): ParserResult<T>

Run the parser on an input string

#### parseOrError(input: string): T | ParserError

Run parser and return result or error

#### parseOrThrow(input: string): T

Run parser and throw on error

#### map<B>(f: (a: T) => B): Parser<B>

Transform parser result

#### flatMap<B>(f: (a: T) => Parser<B>): Parser<B>

Chain parsers

#### error(message: string): Parser<T>

Set error message

#### errorCallback(cb: (error: ParserError, state: ParserState) => string): Parser<T>

Custom error handling

#### tap(callback: (state: ParserState, result: ParserResult<T>) => void): Parser<T>

Adds a tap point to observe the current state and result during parsing

#### withName(name: string): Parser<T>

Name the parser for better errors

### Static Methods

#### parser<T>(f: () => Generator<Parser<any>, T>): Parser<T>

Create parser using generator syntax

#### Parser.succeed<T>(value: T): Parser<T>

Create always-succeeding parser

#### Parser.fail(message: string): Parser<never>

Create always-failing parser

#### Parser.lazy<T>(f: () => Parser<T>): Parser<T>

Creates a new parser that lazily evaluates the given function. This is useful for creating recursive parsers.

### Basic Parsers

#### char(ch: string): Parser<string>

Creates a parser that matches a single character.

```ts
const parser = char("a")
parser.parse("abc") // => "a"
parser.parse("xyz") // throws error
```

#### string(str: string): Parser<string>

Creates a parser that matches an exact string in the input.

```ts
const parser = string("hello")
parser.parse("hello world") // => "hello"
parser.parse("goodbye") // throws error
```

#### regex(re: RegExp): Parser<string>

Creates a parser that matches input against a regular expression. The regex must match at the start of the input.

```ts
const parser = regex(/[0-9]+/)
parser.parse("123abc") // => "123"
```

#### alphabet: Parser<string>

A parser that matches any single alphabetic character (a-z, A-Z).

```ts
const parser = alphabet
parser.parse("abc") // => "a"
parser.parse("123") // throws error
```

#### digit: Parser<string>

A parser that matches any single digit character (0-9).

```ts
const parser = digit
parser.parse("123") // => "1"
parser.parse("abc") // throws error
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
