# Error Handling

Parserator provides comprehensive error handling with detailed error messages, position tracking, and recovery mechanisms.

## Error Types

### ParseError
Individual parsing errors contain:
- `message`: Human-readable error description
- `expected`: Array of what was expected
- `found`: What was actually found
- `pos`: Position in the input where error occurred

### ParseErrorBundle
Collections of related errors, useful for accumulating multiple error sources.

## Basic Error Handling

### Checking for Success/Failure

```typescript
import { string } from 'parserator'

const result = string("hello").parse("goodbye")

if (result.isLeft()) {
  console.log("Parse failed:", result.error.message)
  console.log("At position:", result.error.pos)
} else {
  console.log("Success:", result.value)
}
```

### Using parseOrThrow

For cases where you want exceptions instead of Either types:

```typescript
try {
  const result = string("hello").parseOrThrow("goodbye")
  console.log("Success:", result)
} catch (error) {
  console.log("Parse error:", error.message)
}
```

## Error Context and Position

### Position Information
Errors include detailed position information:

```typescript
const parser = string("expected")
const result = parser.parse("actual input here")

if (result.isLeft()) {
  const pos = result.error.pos
  console.log(`Error at line ${pos.line}, column ${pos.column}`)
  console.log(`Character offset: ${pos.offset}`)
}
```

### Custom Error Messages

#### Using `expect`
Add custom error messages for better user experience:

```typescript
import { char, string } from 'parserator'

const openParen = char("(").expect("opening parenthesis")
const closeParen = char(")").expect("closing parenthesis")

const result = openParen.parse("x")
// Error: "Expected opening parenthesis"
```

#### Using `label`
Label parsers for better error reporting:

```typescript
import { many1, alphabet } from 'parserator'

const identifier = many1(alphabet).label("identifier")
const result = identifier.parse("123")
// Error includes "identifier" in the context
```

## Error Recovery

### Using `or` for Alternatives
Try multiple alternatives and accumulate errors:

```typescript
import { or, string } from 'parserator'

const keyword = or(
  string("if").label("if statement"),
  string("while").label("while loop"),
  string("for").label("for loop")
)

const result = keyword.parse("function")
// Error: "Expected if statement, while loop, or for loop"
```

### Commit and Cut
Use commit to prevent backtracking for better error messages:

```typescript
import { parser, string, commit, char } from 'parserator'

const ifStatement = parser(function* () {
  yield* string("if")
  yield* commit() // No backtracking after this
  yield* char("(").expect("opening parenthesis after 'if'")
  // ... rest of parser
})
```

### Optional and Default Values
Handle optional parts gracefully:

```typescript
import { optional, string, char } from 'parserator'

const greeting = parser(function* () {
  yield* string("hello")
  const name = yield* optional(char(" ").then(identifier))
  return name ? `Hello, ${name}!` : "Hello!"
})
```

## Advanced Error Handling

### Error Transformation
Transform error messages for better user experience:

```typescript
const parser = string("function")
  .mapError(err => ({
    ...err,
    message: "Expected function declaration",
    hint: "Try: function myFunction() { ... }"
  }))
```

### Error Accumulation
Collect multiple errors instead of failing on the first:

```typescript
import { parser, or, many0 } from 'parserator'

const statement = or(
  ifStatement,
  whileStatement,
  assignment
).mapError(err => ({ ...err, context: "statement" }))

const program = many0(statement)
// Continues parsing even if individual statements fail
```

### Fatal Errors
Use fatal errors to immediately stop parsing:

```typescript
import { parser, string, char, Parser } from 'parserator'

const dangerousParser = parser(function* () {
  yield* string("delete")
  yield* char(" ")
  
  // This error cannot be recovered from
  return yield* Parser.fatal("Delete operations are not allowed")
})
```

## Error Formatting

### Pretty Error Messages
Parserator includes utilities for formatting errors nicely:

```typescript
import { formatError } from 'parserator'

const result = parser.parse(input)
if (result.isLeft()) {
  const formatted = formatError(input, result.error)
  console.log(formatted)
  // Outputs:
  // Error at line 2, column 5:
  //   if x > 5 {
  //       ^
  // Expected closing parenthesis
}
```

### Custom Error Formatters
Create your own error formatting:

```typescript
function myErrorFormatter(input: string, error: ParseError): string {
  const lines = input.split('\n')
  const line = lines[error.pos.line - 1]
  const pointer = ' '.repeat(error.pos.column - 1) + '^'
  
  return [
    `Parse Error: ${error.message}`,
    `At line ${error.pos.line}, column ${error.pos.column}:`,
    line,
    pointer
  ].join('\n')
}
```

## Best Practices

### 1. Use Descriptive Labels
```typescript
const number = many1(digit).label("number")
const identifier = many1(alphabet).label("identifier")
```

### 2. Add Context with expect
```typescript
const functionCall = parser(function* () {
  const name = yield* identifier
  yield* char("(").expect("opening parenthesis for function call")
  const args = yield* sepBy(expression, char(","))
  yield* char(")").expect("closing parenthesis for function call")
  return { name, args }
})
```

### 3. Use Commit Strategically
```typescript
const statement = or(
  parser(function* () {
    yield* keyword("if")
    yield* commit() // Committed to parsing if-statement
    // ... rest of if parsing
  }),
  parser(function* () {
    yield* keyword("while") 
    yield* commit() // Committed to parsing while-loop
    // ... rest of while parsing
  }),
  expression // Fallback without commit
)
```

### 4. Provide Recovery Hints
```typescript
const parser = string("expected").mapError(err => ({
  ...err,
  hint: "Did you mean 'expected' instead of '" + err.found + "'?"
}))
```

## Next Steps

- Explore [Advanced Patterns](./advanced-patterns.md)
- Check the [API Reference](/api/) for complete error handling methods
- See [Examples](/examples/) for real-world error handling patterns
