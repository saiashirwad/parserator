# Basic Concepts

## What is a Parser?

A parser is a function that takes an input string and tries to extract structured data from it. In Parserator, every parser is an instance of the `Parser<T>` class, where `T` is the type of value the parser produces when successful.

```typescript
import { string, digit } from 'parserator'

const hello = string("hello")
const num = digit

// Both are Parser instances
console.log(hello.parse("hello world")) // Success: "hello"
console.log(num.parse("123"))           // Success: "1"
```

## Parser Results

Parsers return results wrapped in an `Either` type:
- `Right(value)` for successful parsing
- `Left(error)` for parsing failures

```typescript
const result = string("hello").parse("hello world")
if (result.isRight()) {
  console.log("Parsed:", result.value) // "hello"
} else {
  console.log("Error:", result.error)
}
```

## Parser State

Each parser maintains state information including:
- Current position in the input
- Remaining input to parse
- Line and column numbers for error reporting

```typescript
const output = string("hello").parse("hello world")
console.log(output.state.remaining) // " world"
console.log(output.state.pos.offset) // 5
```

## Composition

Parsers are designed to be composed together to build complex parsers from simple ones:

```typescript
import { string, char, parser } from 'parserator'

const greeting = parser(function* () {
  yield* string("hello")
  yield* char(" ")
  const name = yield* string("world")
  return `Hello, ${name}!`
})

console.log(greeting.parse("hello world")) // Success: "Hello, world!"
```

## Error Handling

Parserator provides detailed error information with context:

```typescript
const result = string("hello").parse("goodbye")
// Error includes:
// - Expected vs actual input
// - Position information
// - Helpful error messages
```

## Next Steps

- Learn about [Parser Combinators](./parser-combinators.md)
- Explore [Error Handling](./error-handling.md) 
- Try [Advanced Patterns](./advanced-patterns.md)
