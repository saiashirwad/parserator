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
* `tap(callback: (state: ParserState, result: ParserResult<T>) => void): Parser<T>` - Adds a tap point to observe the current state and result during parsing
* `withName(name: string): Parser<T>` - Name the parser for better errors

#### Static Methods

* `Parser.gen<T>(f: () => Generator<Parser<any>, T>): Parser<T>` - Create parser using generator syntax
* `Parser.succeed<T>(value: T): Parser<T>` - Create always-succeeding parser
* `Parser.fail(message: string): Parser<never>` - Create always-failing parser
* `Parser.lazy<T>(f: () => Parser<T>): Parser<T>` - Creates a new parser that lazily evaluates the given function. This is useful for creating recursive parsers.

### Combinators

#### Basic Parsers

* `char(ch: string): Parser<string>` - Creates a parser that matches a single character.
  

```ts
  const parser = char("a")
  parser.run("abc") // Right(["a", {...}])
  parser.run("xyz") // Left(error)
  ```

* `string(str: string): Parser<string>` - Creates a parser that matches an exact string in the input.
  

```ts
  const parser = string("hello")
  parser.run("hello world") // Right(["hello", {...}])
  parser.run("goodbye") // Left(error)
  ```

* `regex(re: RegExp): Parser<string>` - Creates a parser that matches input against a regular expression. The regex must match at the start of the input.
  

```ts
  const parser = regex(/[0-9]+/)
  parser.run("123abc") // Right(["123", {...}])
  ```

* `alphabet: Parser<string>` - A parser that matches any single alphabetic character (a-z, A-Z).
  

```ts
  const parser = alphabet
  parser.run("abc") // Right(["a", {...}])
  parser.run("123") // Left(error)
  ```

* `digit: Parser<string>` - A parser that matches any single digit character (0-9).
  

```ts
  const parser = digit
  parser.run("123") // Right(["1", {...}])
  parser.run("abc") // Left(error)
  ```

#### Repetition

* `many0<T>(parser: Parser<T>, separator?: Parser<any>): Parser<T[]>` - Creates a parser that matches zero or more occurrences of the input parser.

* `many1<T>(parser: Parser<T>, separator?: Parser<any>): Parser<T[]>` - Creates a parser that matches one or more occurrences of the input parser.

* `manyN<T>(parser: Parser<T>, n: number, separator?: Parser<any>): Parser<T[]>` - Creates a parser that matches exactly n occurrences of the input parser.

#### Sequencing and Choice

* `sequence<Parsers extends Parser<any>[]>(parsers: [...Parsers]): Parser<LastParser<Parsers>>` - Creates a parser that runs multiple parsers in sequence. Returns the result of the last parser in the sequence.

* `between<T>(start: Parser<any>, end: Parser<any>, parser: Parser<T>): Parser<T>` - Creates a parser that matches content between two string delimiters.
  

```ts
  const parser = between(char('('), char(')'), digit)
  parser.run('(5)') // Right(['5', {...}])
  parser.run('5') // Left(error)
  ```

* `sepBy<S, T>(sepParser: Parser<S>, parser: Parser<T>): Parser<T[]>` - Creates a parser that matches zero or more occurrences of elements separated by a separator.
  

```ts
  const parser = sepBy(char(','), digit)
  parser.run("1,2,3") // Right([["1", "2", "3"], {...}])
  parser.run("") // Right([[], {...}])
  ```

* `or<Parsers extends Parser<any>[]>(...parsers: Parsers): Parser<T>` - Creates a parser that tries multiple parsers in order until one succeeds.

* `optional<T>(parser: Parser<T>): Parser<T | undefined>` - Creates a parser that optionally matches the input parser. If the parser fails, returns undefined without consuming input.

#### Look-ahead and Skipping

* `lookAhead<T>(parser: Parser<T>): Parser<T>` - Creates a parser that looks ahead in the input stream without consuming any input. The parser will succeed with the result of the given parser but won't advance the input position.
  

```ts
  const parser = lookAhead(char('a'))
  parser.run('abc') // Right(['a', {...}])
  // Input position remains at 'abc', 'a' is not consumed
  ```

* `skipSpaces: Parser<undefined>` - A parser that skips any number of space characters.

* `skipMany0<T>(parser: Parser<T>): Parser<undefined>` - Creates a parser that skips zero or more occurrences of the input parser.

* `skipMany1<T>(parser: Parser<T>): Parser<undefined>` - Creates a parser that skips one or more occurrences of the input parser.

* `skipManyN<T>(parser: Parser<T>, n: number): Parser<undefined>` - Creates a parser that skips exactly n occurrences of the input parser.

* `skipUntil<T>(parser: Parser<T>): Parser<undefined>` - Creates a parser that skips input until the given parser succeeds.

#### Debug Tools

* `debug<T>(parser: Parser<T>, label: string): Parser<T>` - Adds debug output to a parser.

* `trace(label: string): Parser<void>` - Creates a parser that logs its input state and continues.

* `debugState(label: string, state: ParserState, result: ParserResult<any>, options?: { inputPreviewLength?: number, separator?: string })` - Creates a debug output for a parser's current state and result.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
