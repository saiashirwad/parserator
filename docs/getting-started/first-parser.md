# Your First Parser

This guide will walk you through creating your first parser with Parserator, starting from simple examples and building up to more complex ones.

## Hello World Parser

Let's start with the simplest possible parser - one that matches the string "Hello":

```typescript
import { string } from 'parserator'

const helloParser = string('Hello')

// Test it
const result = helloParser.parse('Hello')
console.log(result) // { result: Right("Hello"), state: {...} }

// Or use the simpler parseOrThrow method
const value = helloParser.parseOrThrow('Hello')
console.log(value) // "Hello"
```

## Understanding Parser Results

Parsers return a result object with two fields:
- `result`: Either a success (`Right`) or failure (`Left`)
- `state`: Information about the parsing state

```typescript
import { string } from 'parserator'
import { Either } from 'parserator'

const parser = string('Hello')

// Successful parse
const success = parser.parse('Hello World')
if (Either.isRight(success.result)) {
  console.log('Parsed:', success.result.right) // "Hello"
  console.log('Remaining:', success.state.remaining) // " World"
}

// Failed parse
const failure = parser.parse('Goodbye')
if (Either.isLeft(failure.result)) {
  console.log('Error:', failure.result.left) // ParseErrorBundle
}
```

## Combining Parsers

The real power of parser combinators comes from combining simple parsers into complex ones:

```typescript
import { string, char } from 'parserator'

// Parse "Hello" followed by a space and then "World"
const greeting = string('Hello')
  .then(char(' '))
  .then(string('World'))

console.log(greeting.parseOrThrow('Hello World')) // "World"
```

Notice that `.then()` returns the result of the second parser. If you want to keep both results, use `.zip()`:

```typescript
const greeting = string('Hello').zip(string('World'))
console.log(greeting.parseOrThrow('HelloWorld')) // ["Hello", "World"]
```

## Parsing Numbers

Let's create a parser for integers:

```typescript
import { digit, many1 } from 'parserator'

// Parse one or more digits
const number = many1(digit).map(digits => parseInt(digits.join('')))

console.log(number.parseOrThrow('123')) // 123
console.log(number.parseOrThrow('456abc')) // 456 (stops at 'a')
```

## Handling Optional Content

Use `optional` for content that may or may not be present:

```typescript
import { char, digit, many1, optional } from 'parserator'

// Parse an optional minus sign followed by digits
const signedNumber = optional(char('-'))
  .zip(many1(digit))
  .map(([sign, digits]) => {
    const num = parseInt(digits.join(''))
    return sign === '-' ? -num : num
  })

console.log(signedNumber.parseOrThrow('123'))  // 123
console.log(signedNumber.parseOrThrow('-456')) // -456
```

## Choices with `or`

Use `or` to try multiple alternatives:

```typescript
import { string, or } from 'parserator'

const greeting = or(
  string('Hello'),
  string('Hi'),
  string('Hey')
)

console.log(greeting.parseOrThrow('Hi there')) // "Hi"
console.log(greeting.parseOrThrow('Hey you'))  // "Hey"
```

## Whitespace Handling

Real parsers often need to handle whitespace:

```typescript
import { string, char, regex, many0 } from 'parserator'

// Parser for optional whitespace
const ws = many0(or(char(' '), char('\t'), char('\n')))

// Parser for required whitespace
const ws1 = many1(or(char(' '), char('\t'), char('\n')))

// Or use regex for convenience
const whitespace = regex(/\s*/) // Zero or more whitespace
const space = regex(/\s+/)      // One or more whitespace

// Parse "Hello World" with flexible whitespace
const greeting = string('Hello')
  .thenDiscard(space)  // Consume but ignore whitespace
  .then(string('World'))

console.log(greeting.parseOrThrow('Hello    World')) // "World"
```

## Error Handling

Parserator provides helpful error messages:

```typescript
import { string, char } from 'parserator'

const parser = string('Hello').then(char(' ')).then(string('World'))

try {
  parser.parseOrThrow('Hello Universe')
} catch (error) {
  console.log(error) // Will show what was expected vs. what was found
}
```

You can also add custom error messages:

```typescript
const parser = string('Hello')
  .withError(() => 'Expected a greeting')
  .then(char(' '))
  .then(string('World'))
  .withError(() => 'Expected "Hello World"')
```

## Using Generator Syntax

For complex parsers, generator syntax can be more readable:

```typescript
import { Parser, string, char, many1, digit } from 'parserator'

const dateParser = Parser.gen(function* () {
  const year = yield* many1(digit).map(d => parseInt(d.join('')))
  yield* char('-')
  const month = yield* many1(digit).map(d => parseInt(d.join('')))
  yield* char('-')
  const day = yield* many1(digit).map(d => parseInt(d.join('')))
  
  return { year, month, day }
})

console.log(dateParser.parseOrThrow('2023-12-25'))
// { year: 2023, month: 12, day: 25 }
```

## A Complete Example: Simple Calculator

Let's build a calculator that can handle addition and multiplication:

```typescript
import { Parser, char, digit, many1, or, regex } from 'parserator'

// Basic building blocks
const ws = regex(/\s*/)
const number = many1(digit).map(digits => parseInt(digits.join('')))

// Expression parser using generator syntax
const expression: Parser<number> = Parser.gen(function* () {
  let result = yield* term
  
  while (true) {
    yield* ws
    const op = yield* optional(or(char('+'), char('-')))
    if (!op) break
    
    yield* ws
    const right = yield* term
    
    if (op === '+') {
      result = result + right
    } else {
      result = result - right
    }
  }
  
  return result
})

const term: Parser<number> = Parser.gen(function* () {
  let result = yield* factor
  
  while (true) {
    yield* ws
    const op = yield* optional(or(char('*'), char('/')))
    if (!op) break
    
    yield* ws
    const right = yield* factor
    
    if (op === '*') {
      result = result * right
    } else {
      result = Math.floor(result / right)
    }
  }
  
  return result
})

const factor: Parser<number> = or(
  // Parenthesized expression
  Parser.gen(function* () {
    yield* char('(')
    yield* ws
    const result = yield* expression
    yield* ws
    yield* char(')')
    return result
  }),
  // Simple number
  number
)

// Test the calculator
console.log(expression.parseOrThrow('2 + 3 * 4'))     // 14
console.log(expression.parseOrThrow('(2 + 3) * 4'))   // 20
console.log(expression.parseOrThrow('10 - 2 + 3'))    // 11
```

## Next Steps

Now that you've built your first parsers, you can:

1. [Learn more about core concepts](./core-concepts.md)
2. [Explore the full API](../api/parser.md)
3. [Study complete examples](../examples/json-parser.md)
4. [Learn about error handling](../api/error-handling.md)

## Common Pitfalls

**Parser doesn't advance**: Make sure your parser consumes input. Empty matches can cause infinite loops:

```typescript
// ❌ Bad - can match empty string
const bad = many0(regex(/a*/))

// ✅ Good - always consumes at least one character
const good = many0(regex(/a+/))
```

**Order matters in `or`**: The first matching parser wins:

```typescript
// ❌ Bad - "function" will never match because "fun" matches first
const bad = or(string('fun'), string('function'))

// ✅ Good - longest match first
const good = or(string('function'), string('fun'))
```

**Forgetting to handle whitespace**: Real-world parsers need explicit whitespace handling:

```typescript
// ❌ Bad - won't handle "x + y"
const bad = char('x').then(char('+')).then(char('y'))

// ✅ Good - handles whitespace
const good = char('x').thenDiscard(ws).then(char('+')).thenDiscard(ws).then(char('y'))
```
