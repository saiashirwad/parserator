# JSON Parser Example

This comprehensive example demonstrates how to build a complete JSON parser using Parserator. We'll build it step by step, showing how to handle all JSON data types and proper error reporting.

## Overview

JSON (JavaScript Object Notation) is a lightweight data interchange format. A complete JSON parser needs to handle:

- **Null**: `null`
- **Booleans**: `true`, `false`
- **Numbers**: `42`, `-3.14`, `1.23e-10`
- **Strings**: `"hello"`, `"with \"quotes\""`
- **Arrays**: `[1, 2, 3]`, `["a", "b"]`
- **Objects**: `{"key": "value"}`, `{"nested": {"object": true}}`

## Basic Setup

```typescript
import {
  Parser,
  char,
  string,
  regex,
  many0,
  many1,
  or,
  optional,
  sepBy,
  between,
  skipSpaces
} from 'parserator'

// JSON value type
type JsonValue = 
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }
```

## Step 1: Whitespace Handling

JSON allows whitespace (spaces, tabs, newlines, carriage returns) between tokens:

```typescript
// Whitespace parser
const ws = regex(/\s*/).label('whitespace')

// Helper to parse a token followed by optional whitespace
const token = <T>(parser: Parser<T>): Parser<T> => 
  parser.thenDiscard(ws)

// Parse specific characters as tokens
const lbrace = token(char('{'))
const rbrace = token(char('}'))
const lbracket = token(char('['))
const rbracket = token(char(']'))
const comma = token(char(','))
const colon = token(char(':'))
```

## Step 2: Null Parser

The simplest JSON value is `null`:

```typescript
const jsonNull = token(string('null'))
  .map(() => null as JsonValue)
  .label('null')
```

## Step 3: Boolean Parser

JSON has two boolean literals:

```typescript
const jsonBoolean = token(
  or(
    string('true').map(() => true),
    string('false').map(() => false)
  )
).label('boolean')
```

## Step 4: Number Parser

JSON numbers follow a specific format:

```typescript
const jsonNumber = token(
  regex(/-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/)
)
  .map(str => parseFloat(str))
  .label('number')
```

Let's break down this regex:
- `-?`: Optional minus sign
- `(0|[1-9]\d*)`: Either zero or number starting with 1-9
- `(\.\d+)?`: Optional decimal part
- `([eE][+-]?\d+)?`: Optional scientific notation

## Step 5: String Parser

JSON strings are more complex due to escape sequences:

```typescript
// Parse escape sequences
const escapeSequence = char('\\').then(
  or(
    char('"').map(() => '"'),
    char('\\').map(() => '\\'),
    char('/').map(() => '/'),
    char('b').map(() => '\b'),
    char('f').map(() => '\f'),
    char('n').map(() => '\n'),
    char('r').map(() => '\r'),
    char('t').map(() => '\t'),
    char('u').then(
      regex(/[0-9a-fA-F]{4}/).map(hex => 
        String.fromCharCode(parseInt(hex, 16))
      )
    )
  )
).label('escape sequence')

// Parse string content (everything except quotes and backslashes)
const stringChar = or(
  escapeSequence,
  regex(/[^"\\]/)
).label('string character')

// Complete string parser
const jsonString = token(
  between(
    char('"'),
    char('"'),
    many0(stringChar).map(chars => chars.join(''))
  )
).label('string')
```

## Step 6: Array Parser

Arrays contain comma-separated values enclosed in brackets:

```typescript
// Forward declaration for recursive types
let jsonValue: Parser<JsonValue>

const jsonArray = token(
  between(
    lbracket,
    rbracket,
    sepBy(comma, Parser.lazy(() => jsonValue))
  )
).label('array')
```

## Step 7: Object Parser

Objects contain comma-separated key-value pairs:

```typescript
// Object key-value pair
const objectPair = Parser.gen(function* () {
  const key = yield* jsonString
  yield* colon
  const value = yield* Parser.lazy(() => jsonValue)
  return [key, value] as const
})

const jsonObject = token(
  between(
    lbrace,
    rbrace,
    sepBy(comma, objectPair)
  )
)
  .map(pairs => Object.fromEntries(pairs))
  .label('object')
```

## Step 8: Complete JSON Parser

Now we can combine all the parsers:

```typescript
// Define the main JSON value parser
jsonValue = or(
  jsonNull,
  jsonBoolean,
  jsonNumber,
  jsonString,
  jsonArray,
  jsonObject
).label('JSON value')

// Complete JSON parser (handles leading/trailing whitespace)
export const jsonParser = ws.then(jsonValue).thenDiscard(ws)
```

## Complete Implementation

Here's the full JSON parser in one file:

```typescript
import {
  Parser,
  char,
  string,
  regex,
  many0,
  or,
  sepBy,
  between
} from 'parserator'

type JsonValue = 
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

// Whitespace and tokens
const ws = regex(/\s*/)
const token = <T>(parser: Parser<T>) => parser.thenDiscard(ws)

const lbrace = token(char('{'))
const rbrace = token(char('}'))
const lbracket = token(char('['))
const rbracket = token(char(']'))
const comma = token(char(','))
const colon = token(char(':'))

// Primitive values
const jsonNull = token(string('null')).map(() => null as JsonValue)
const jsonBoolean = token(or(
  string('true').map(() => true),
  string('false').map(() => false)
))
const jsonNumber = token(regex(/-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/))
  .map(parseFloat)

// String parsing
const escapeChar = char('\\').then(or(
  char('"').map(() => '"'),
  char('\\').map(() => '\\'),
  char('/').map(() => '/'),
  char('b').map(() => '\b'),
  char('f').map(() => '\f'),
  char('n').map(() => '\n'),
  char('r').map(() => '\r'),
  char('t').map(() => '\t'),
  char('u').then(regex(/[0-9a-fA-F]{4}/).map(hex => 
    String.fromCharCode(parseInt(hex, 16))
  ))
))

const stringChar = or(escapeChar, regex(/[^"\\]/))
const jsonString = token(between(
  char('"'),
  char('"'),
  many0(stringChar).map(chars => chars.join(''))
))

// Forward declaration for recursion
let jsonValue: Parser<JsonValue>

// Array and object
const jsonArray = token(between(
  lbracket,
  rbracket,
  sepBy(comma, Parser.lazy(() => jsonValue))
))

const objectPair = Parser.gen(function* () {
  const key = yield* jsonString
  yield* colon
  const value = yield* Parser.lazy(() => jsonValue)
  return [key, value] as const
})

const jsonObject = token(between(
  lbrace,
  rbrace,
  sepBy(comma, objectPair)
)).map(pairs => Object.fromEntries(pairs))

// Complete JSON value
jsonValue = or(
  jsonNull,
  jsonBoolean,
  jsonNumber,
  jsonString,
  jsonArray,
  jsonObject
)

// Main parser
export const jsonParser = ws.then(jsonValue).thenDiscard(ws)
```

## Usage Examples

### Basic Usage

```typescript
// Parse simple values
console.log(jsonParser.parseOrThrow('null'))      // null
console.log(jsonParser.parseOrThrow('true'))      // true
console.log(jsonParser.parseOrThrow('42'))        // 42
console.log(jsonParser.parseOrThrow('"hello"'))   // "hello"

// Parse arrays
console.log(jsonParser.parseOrThrow('[1, 2, 3]')) 
// [1, 2, 3]

// Parse objects
console.log(jsonParser.parseOrThrow('{"name": "John", "age": 30}'))
// { name: "John", age: 30 }
```

### Complex Example

```typescript
const complexJson = `{
  "name": "John Doe",
  "age": 30,
  "isStudent": false,
  "address": {
    "street": "123 Main St",
    "city": "Anytown",
    "zipCode": "12345"
  },
  "hobbies": ["reading", "programming", "hiking"],
  "spouse": null,
  "gpa": 3.85e0
}`

const result = jsonParser.parseOrThrow(complexJson)
console.log(result)
// {
//   name: "John Doe",
//   age: 30,
//   isStudent: false,
//   address: { street: "123 Main St", city: "Anytown", zipCode: "12345" },
//   hobbies: ["reading", "programming", "hiking"],
//   spouse: null,
//   gpa: 3.85
// }
```

### Error Handling

```typescript
import { Either, ErrorFormatter } from 'parserator'

function parseJson(input: string): JsonValue {
  const result = jsonParser.parse(input)
  
  if (Either.isRight(result.result)) {
    return result.result.right
  } else {
    const formatter = new ErrorFormatter('ansi')
    const errorMessage = formatter.format(result.result.left)
    throw new Error(`JSON Parse Error:\n${errorMessage}`)
  }
}

// Test error handling
try {
  parseJson('{"key": }')  // Invalid JSON
} catch (error) {
  console.error(error.message)
  // Will show detailed error with position and context
}
```

## Advanced Features

### Custom JSON with Comments

Extend the parser to support comments:

```typescript
const lineComment = string('//').then(regex(/[^\n]*/))
const blockComment = string('/*').then(regex(/.*?\*\//s))
const comment = or(lineComment, blockComment)

const wsWithComments = many0(or(regex(/\s+/), comment))
const tokenWithComments = <T>(parser: Parser<T>) => 
  parser.thenDiscard(wsWithComments)

// Use tokenWithComments instead of token for comment support
```

### Streaming JSON Parser

For large JSON files, you might want to parse incrementally:

```typescript
function* parseJsonStream(input: string): Generator<JsonValue> {
  let remaining = input
  
  while (remaining.trim()) {
    const result = jsonParser.parse(remaining)
    
    if (Either.isRight(result.result)) {
      yield result.result.right
      remaining = result.state.remaining.trim()
      
      // Skip optional comma between values
      if (remaining.startsWith(',')) {
        remaining = remaining.slice(1).trim()
      }
    } else {
      throw new Error('Parse failed')
    }
  }
}

// Usage
const jsonStream = '[1, 2, 3] {"a": 1} "hello"'
for (const value of parseJsonStream(jsonStream)) {
  console.log(value)
}
// Outputs: [1, 2, 3], {a: 1}, "hello"
```

### Type-Safe JSON Parsing

Add runtime type checking:

```typescript
interface User {
  name: string
  age: number
  email?: string
}

function parseUser(input: string): User {
  const value = jsonParser.parseOrThrow(input)
  
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected object')
  }
  
  const obj = value as Record<string, unknown>
  
  if (typeof obj.name !== 'string') {
    throw new Error('Expected name to be string')
  }
  
  if (typeof obj.age !== 'number') {
    throw new Error('Expected age to be number')
  }
  
  if (obj.email !== undefined && typeof obj.email !== 'string') {
    throw new Error('Expected email to be string or undefined')
  }
  
  return {
    name: obj.name,
    age: obj.age,
    email: obj.email as string | undefined
  }
}
```

## Performance Considerations

1. **Parser Reuse**: Create the parser once and reuse it
2. **Large Objects**: For very large JSON, consider streaming
3. **Memory**: The parser loads the entire structure into memory
4. **Error Context**: Detailed errors come with some performance cost

## Testing

```typescript
import { describe, test, expect } from 'bun:test'

describe('JSON Parser', () => {
  test('parses primitive values', () => {
    expect(jsonParser.parseOrThrow('null')).toBe(null)
    expect(jsonParser.parseOrThrow('true')).toBe(true)
    expect(jsonParser.parseOrThrow('false')).toBe(false)
    expect(jsonParser.parseOrThrow('42')).toBe(42)
    expect(jsonParser.parseOrThrow('"hello"')).toBe('hello')
  })
  
  test('parses arrays', () => {
    expect(jsonParser.parseOrThrow('[]')).toEqual([])
    expect(jsonParser.parseOrThrow('[1, 2, 3]')).toEqual([1, 2, 3])
  })
  
  test('parses objects', () => {
    expect(jsonParser.parseOrThrow('{}')).toEqual({})
    expect(jsonParser.parseOrThrow('{"a": 1}')).toEqual({ a: 1 })
  })
  
  test('handles whitespace', () => {
    expect(jsonParser.parseOrThrow('  { "a" : 1 }  ')).toEqual({ a: 1 })
  })
  
  test('handles escape sequences', () => {
    expect(jsonParser.parseOrThrow('"\\n\\t\\""')).toBe('\n\t"')
  })
})
```

## Comparison with Native JSON.parse

Our parser has several advantages over the native `JSON.parse`:

1. **Better Error Messages**: Detailed position and context information
2. **Customizable**: Easy to extend with comments, trailing commas, etc.
3. **Type Safety**: Can integrate with TypeScript for better type checking
4. **Educational**: Shows how parsing works under the hood

However, `JSON.parse` is much faster for production use with valid JSON.

## Next Steps

- [INI Parser Example](./ini-parser.md) - Learn to parse configuration files
- [Calculator Example](./calculator.md) - Build an expression evaluator
- [Error Handling Guide](../api/error-handling.md) - Advanced error strategies
- [Performance Tips](../advanced/performance.md) - Optimize your parsers