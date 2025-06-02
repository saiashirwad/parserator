# Core Concepts

This guide covers the fundamental concepts you need to understand to use Parserator effectively.

## What is a Parser?

A parser is a function that takes an input string and attempts to extract structured data from it. In Parserator, parsers are represented by the `Parser<T>` class, where `T` is the type of value the parser produces.

```typescript
// A parser that produces a string
const stringParser: Parser<string> = string('hello')

// A parser that produces a number
const numberParser: Parser<number> = many1(digit).map(d => parseInt(d.join('')))

// A parser that produces a custom type
interface Person {
  name: string
  age: number
}
const personParser: Parser<Person> = /* ... */
```

## Parser State

When a parser runs, it maintains state about:
- **Position**: Current line, column, and character offset
- **Remaining input**: The portion of input not yet consumed
- **Context**: Additional information like source text and debug flags

```typescript
import { State } from 'parserator'

const state = State.fromInput('hello world', { source: 'hello world' })
console.log(state.pos)        // { line: 1, column: 1, offset: 0 }
console.log(state.remaining)  // 'hello world'
```

## Success and Failure

Parsers can either succeed or fail. Parserator uses the `Either` type to represent this:

```typescript
import { Either } from 'parserator'

const parser = string('hello')

const success = parser.parse('hello world')
if (Either.isRight(success.result)) {
  console.log('Success:', success.result.right)  // 'hello'
  console.log('Remaining:', success.state.remaining)  // ' world'
}

const failure = parser.parse('goodbye')
if (Either.isLeft(failure.result)) {
  console.log('Failure:', failure.result.left)  // ParseErrorBundle
}
```

## Parser Combinators

Combinators are functions that take one or more parsers and combine them into a new parser. This is the heart of the combinator approach:

### Sequencing: `then` and `thenDiscard`

```typescript
// Parse 'hello' then ' ' then 'world', return the last result
const greeting1 = string('hello').then(char(' ')).then(string('world'))
// Result: 'world'

// Parse but keep the first result
const greeting2 = string('hello').thenDiscard(char(' ')).thenDiscard(string('world'))
// Result: 'hello'
```

### Pairing: `zip`

```typescript
// Parse both and return both results as a tuple
const greeting = string('hello').zip(string('world'))
// Result: ['hello', 'world']
```

### Choice: `or`

```typescript
// Try multiple alternatives, return first success
const greeting = or(
  string('hello'),
  string('hi'),
  string('hey')
)
```

### Repetition: `many0`, `many1`, `manyN`

```typescript
// Zero or more digits
const digits1 = many0(digit)  // Can match empty string

// One or more digits
const digits2 = many1(digit)  // Must match at least one

// Exactly 3 digits
const digits3 = manyNExact(digit, 3)
```

### Optional: `optional`

```typescript
// Parse optional minus sign
const sign = optional(char('-'))
// Result: '-' or undefined
```

## Transformation with `map`

Use `map` to transform parser results:

```typescript
// Parse digits and convert to number
const number = many1(digit).map(digits => parseInt(digits.join('')))

// Parse and create an object
const point = char('(')
  .then(many1(digit).map(d => parseInt(d.join(''))))
  .thenDiscard(char(','))
  .zip(many1(digit).map(d => parseInt(d.join(''))))
  .thenDiscard(char(')'))
  .map(([x, y]) => ({ x, y }))
```

## Monadic Composition with `flatMap`

For more complex transformations that depend on previous results:

```typescript
// Parse a length-prefixed string
const lengthPrefixedString = many1(digit)
  .map(d => parseInt(d.join('')))
  .flatMap(length => 
    manyNExact(anyChar(), length).map(chars => chars.join(''))
  )

// Example: "5hello" -> "hello"
```

## Generator Syntax

For complex parsers, generator syntax provides a more imperative style:

```typescript
const dateParser = Parser.gen(function* () {
  const year = yield* many1(digit).map(d => parseInt(d.join('')))
  yield* char('-')
  const month = yield* many1(digit).map(d => parseInt(d.join('')))
  yield* char('-')
  const day = yield* many1(digit).map(d => parseInt(d.join('')))
  
  return new Date(year, month - 1, day)
})
```

## Error Handling

### Basic Error Information

Parserator provides rich error information including position, context, and suggestions:

```typescript
const parser = string('expected')

try {
  parser.parseOrThrow('actual')
} catch (error) {
  // error is a ParseErrorBundle with detailed information
  console.log(error.primary.span.line)    // Line number
  console.log(error.primary.span.column)  // Column number
  console.log(error.source)               // Original input
}
```

### Custom Error Messages

```typescript
const parser = string('hello')
  .withError(() => 'Expected a greeting')

const parser2 = many1(digit)
  .withError(({ state }) => 
    `Expected a number at position ${state.pos.offset}`
  )
```

### Labels for Better Errors

```typescript
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/)
  .label('identifier')

const number = many1(digit)
  .map(d => parseInt(d.join('')))
  .label('number')

// Errors will mention "identifier" or "number" instead of low-level details
```

## Lookahead and Backtracking

### Looking Ahead

```typescript
// Look at the next character without consuming it
const nextChar = lookAhead(anyChar())

// Check that something is NOT present
const notNumber = notFollowedBy(digit)
```

### No Automatic Backtracking

Parserator doesn't backtrack automatically. Once a parser consumes input, it's committed:

```typescript
// This won't work as expected
const bad = string('function').or(string('fun'))
// If input is "fun", the first parser will fail after consuming "fun"

// This works correctly
const good = string('function').or(string('fun'))
// Longer alternatives should come first
```

## Recursive Parsers

Use `Parser.lazy()` for recursive grammars:

```typescript
// Forward declaration
let expression: Parser<number>

const factor = or(
  // Parenthesized expression
  char('(').then(Parser.lazy(() => expression)).thenDiscard(char(')')),
  // Number
  many1(digit).map(d => parseInt(d.join('')))
)

const term = sepBy1(char('*'), factor).map(factors => 
  factors.reduce((a, b) => a * b)
)

expression = sepBy1(char('+'), term).map(terms => 
  terms.reduce((a, b) => a + b)
)
```

## Working with Context

You can add custom context to your parsers:

```typescript
interface MyContext {
  debug: boolean
  variables: Map<string, number>
}

const parser = Parser.gen<number, MyContext>(function* () {
  // Access context through state
  const state = yield* peekState  // Utility to get current state
  if (state.context.debug) {
    console.log('Debug mode enabled')
  }
  
  // ... rest of parser
})

// Use with context
const result = parser.parse('input', { 
  debug: true, 
  variables: new Map(),
  source: 'input'
})
```

## Performance Considerations

### Avoiding Infinite Loops

```typescript
// ❌ Bad - can match empty string infinitely
const bad = many0(regex(/a*/))

// ✅ Good - always consumes input
const good = many0(regex(/a+/))
```

### Parser Reuse

```typescript
// ❌ Bad - creates new parser each time
function makeBadParser() {
  return many1(digit).map(d => parseInt(d.join('')))
}

// ✅ Good - reuse parser instances
const goodParser = many1(digit).map(d => parseInt(d.join('')))
```

### Left Recursion

Parser combinators can't handle direct left recursion:

```typescript
// ❌ This will cause infinite recursion
let expr: Parser<any> = Parser.lazy(() =>
  expr.then(char('+')).then(expr)  // Left recursive!
)

// ✅ Use iteration instead
const expr = sepBy1(char('+'), number)
```

## Type Safety

Parserator provides excellent TypeScript support:

```typescript
// Types are inferred automatically
const stringParser = string('hello')  // Parser<string>
const numberParser = many1(digit).map(d => parseInt(d.join('')))  // Parser<number>

// Complex types work too
interface User {
  name: string
  age: number
}

const userParser: Parser<User> = Parser.gen(function* () {
  const name = yield* stringLiteral  // Parser<string>
  yield* char(',')
  const age = yield* numberParser   // Parser<number>
  return { name, age }  // Correctly typed as User
})
```

## Debugging

Use debug utilities to understand parser behavior:

```typescript
import { debug, trace } from 'parserator'

const parser = debug(string('hello'), 'greeting parser')
  .then(trace('after greeting'))
  .then(string('world'))

// Will log detailed information about parsing progress
```

## Next Steps

Now that you understand the core concepts:

1. [Explore the API reference](../api/parser.md) for detailed information
2. [Learn about advanced topics](../advanced/generator-syntax.md)
3. [Study real-world examples](../examples/json-parser.md)
4. [Learn best practices](../guides/best-practices.md)