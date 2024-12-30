# Parserator

> **Warning**
> This library is currently in early development and the API is subject to change. There are *several* bugs. Please don't use, even at your own risk. I am absolutely responsible for any bugs, so holler at me at [@texoport.in](https://bsky.app/profile/texoport.in).

A TypeScript parser combinator library inspired by [Parsec](https://github.com/haskell/parsec) and [Effect-TS](https://github.com/Effect-ts/Effect). Write parsers using a clean, generator-based syntax or compose them using functional combinators.

## Table of Contents

* [Installation](#installation)
* [Basic Usage](#basic-usage)
* [Generator Syntax](#generator-syntax)
* [Primitive Parsers](#primitive-parsers)
* [Combinators](#combinators)
* [Error Handling](#error-handling)
* [Debugging](#debugging)
* [Advanced Usage](#advanced-usage)
* [API Reference](#api-reference)

## Installation

```bash
npm install parserator
```

## Basic Usage

```typescript
import { Parser, char, many1, digit } from 'parserator'

// Create a simple number parser
const numberParser = many1(digit).map(digits => parseInt(digits.join(""), 10))

// Parse a string
const result = numberParser.run("123")
// Right([123, {...}])

// Handle errors
const error = numberParser.run("abc")
// Left(ParserError: Expected digit but found 'a')
```

## Generator Syntax

Write parsers using a clean, generator-based syntax that feels like async/await:

```typescript
import { Parser, char, many1, digit, optional } from 'parserator'

// Parse a floating point number
const float = Parser.gen(function* () {
  // Parse optional sign
  const sign = yield* optional(char("-"))
  
  // Parse integer part
  const intPart = yield* many1(digit)
  
  // Parse optional fractional part
  const fractionalPart = yield* optional(
    Parser.gen(function* () {
      yield* char(".")
      return yield* many1(digit)
    })
  )
  
  // Parse optional exponent
  const exponentPart = yield* optional(
    Parser.gen(function* () {
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

## Primitive Parsers

### Character Parsers

```typescript
import { char, string, regex, alphabet, digit } from 'parserator'

// Match a single character
char("a").run("abc") // Right(["a", ...])

// Match an exact string
string("hello").run("hello world") // Right(["hello", ...])

// Match using regex
regex(/[0-9]+/).run("123abc") // Right(["123", ...])

// Match any letter
alphabet.run("abc") // Right(["a", ...])

// Match any digit
digit.run("123") // Right(["1", ...])
```

## Combinators

### Repetition

```typescript
import { many0, many1, manyN, digit } from 'parserator'

// Match zero or more
many0(digit).run("123abc") // Right([["1","2","3"], ...])

// Match one or more
many1(digit).run("123abc") // Right([["1","2","3"], ...])

// Match exact number
manyN(digit, 2).run("123") // Right([["1","2"], ...])
```

### Sequencing and Choice

```typescript
import { sequence, or, between, sepBy } from 'parserator'

// Run parsers in sequence
sequence([char("a"), char("b")]).run("abc")
// Right(["b", ...])

// Try multiple parsers
or(char("a"), char("b")).run("abc")
// Right(["a", ...])

// Match between delimiters
between(char("("), char(")"), digit).run("(5)")
// Right(["5", ...])

// Match separated values
sepBy(char(","), digit).run("1,2,3")
// Right([["1","2","3"], ...])
```

### Look-ahead and Skipping

```typescript
import { lookAhead, skipSpaces } from 'parserator'

// Look ahead without consuming
lookAhead(char("a")).run("abc")
// Right(["a", ...]) // Position stays at "abc"

// Skip whitespace
skipSpaces.then(char("a")).run("   abc")
// Right(["a", ...])
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
import { debug, trace } from 'parserator'

// Add debug output
const debuggedParser = debug(parser, "number-parser")

// Add trace points
const tracedParser = trace("Before parsing number")
  .then(parser)
```

## Advanced Usage

### JSON Array Parser

```typescript
const jsonArray = Parser.gen(function* () {
  yield* char("[")
  yield* skipSpaces
  
  const items = yield* sepBy(
    char(","),
    Parser.gen(function* () {
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
  Parser.gen(function* () {
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

#### Methods

* `run(input: string): ParserResult<T>` - Run the parser on an input string
* `parseOrError(input: string): T | ParserError` - Run parser and return result or error
* `parseOrThrow(input: string): T` - Run parser and throw on error
* `map<B>(f: (a: T) => B): Parser<B>` - Transform parser result
* `flatMap<B>(f: (a: T) => Parser<B>): Parser<B>` - Chain parsers
* `error(message: string): Parser<T>` - Set error message
* `errorCallback(cb: (error: ParserError, state: ParserState) => string): Parser<T>` - Custom error handling
* `withName(name: string): Parser<T>` - Name the parser for better errors

#### Static Methods

* `Parser.gen<T>(f: () => Generator<Parser<any>, T>): Parser<T>` - Create parser using generator syntax
* `Parser.succeed<T>(value: T): Parser<T>` - Create always-succeeding parser
* `Parser.fail(message: string): Parser<never>` - Create always-failing parser
* `Parser.lazy<T>(f: () => Parser<T>): Parser<T>` - Create recursive parser

### Combinators

#### Basic Parsers

* `char(c: string): Parser<string>` - Match single character
* `string(s: string): Parser<string>` - Match exact string
* `regex(re: RegExp): Parser<string>` - Match regex pattern
* `alphabet: Parser<string>` - Match any letter
* `digit: Parser<string>` - Match any digit

#### Repetition

* `many0<T>(parser: Parser<T>): Parser<T[]>` - Match zero or more
* `many1<T>(parser: Parser<T>): Parser<T[]>` - Match one or more
* `manyN<T>(parser: Parser<T>, n: number): Parser<T[]>` - Match exact count

#### Sequencing

* `sequence<T>(parsers: Parser<T>[]): Parser<T>` - Run parsers in sequence
* `between<T>(open: Parser<any>, close: Parser<any>, parser: Parser<T>): Parser<T>` - Match between delimiters
* `sepBy<T>(sep: Parser<any>, parser: Parser<T>): Parser<T[]>` - Match separated values

#### Choice and Optional

* `or<T>(...parsers: Parser<T>[]): Parser<T>` - Try multiple parsers
* `optional<T>(parser: Parser<T>): Parser<T | undefined>` - Make parser optional

#### Look-ahead and Skipping

* `lookAhead<T>(parser: Parser<T>): Parser<T>` - Look ahead without consuming
* `skipSpaces: Parser<undefined>` - Skip whitespace
* `skipMany0<T>(parser: Parser<T>): Parser<undefined>` - Skip zero or more
* `skipMany1<T>(parser: Parser<T>): Parser<undefined>` - Skip one or more
* `skipManyN<T>(parser: Parser<T>, n: number): Parser<undefined>` - Skip exact count

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
