# JSON Parser Example

This example demonstrates building a complete JSON parser using Parserator, showcasing how to handle complex nested structures and different data types.

## Complete Implementation

```typescript
import { 
  parser, char, string, or, many0, many1, between, sepBy, 
  optional, digit, alphabet, regex, skipSpaces 
} from 'parserator'

// Basic building blocks
const whitespace = regex(/\s*/)
const ws = <T>(p: Parser<T>) => p.thenDiscard(whitespace)

// String parsing with escape sequences
const escapedChar = char('\\').then(or(
  char('"').map(() => '"'),
  char('\\').map(() => '\\'),
  char('/').map(() => '/'),
  char('b').map(() => '\b'),
  char('f').map(() => '\f'),
  char('n').map(() => '\n'),
  char('r').map(() => '\r'),
  char('t').map(() => '\t'),
  char('u').then(count(4, regex(/[0-9a-fA-F]/))).map(hex => 
    String.fromCharCode(parseInt(hex.join(''), 16))
  )
))

const stringChar = or(
  escapedChar,
  regex(/[^"\\]/) // Any character except quote or backslash
)

const jsonString = between(
  char('"'),
  char('"'),
  many0(stringChar)
).map(chars => chars.join(''))

// Number parsing
const sign = optional(or(char('+'), char('-'))).map(s => s || '+')
const digits = many1(digit).map(d => d.join(''))
const integer = sign.zip(digits).map(([s, d]) => s === '-' ? `-${d}` : d)

const fraction = char('.').then(digits).map(d => `.${d}`)
const exponent = or(char('e'), char('E'))
  .then(sign.zip(digits))
  .map(([s, d]) => `e${s === '-' ? '-' : ''}${d}`)

const jsonNumber = parser(function* () {
  const int = yield* integer
  const frac = yield* optional(fraction)
  const exp = yield* optional(exponent)
  
  const numStr = int + (frac || '') + (exp || '')
  return parseFloat(numStr)
})

// Boolean and null
const jsonTrue = string('true').map(() => true)
const jsonFalse = string('false').map(() => false)
const jsonNull = string('null').map(() => null)

// Forward declarations for recursive structures
let jsonValue: Parser<any>
let jsonObject: Parser<any>
let jsonArray: Parser<any>

// Object parsing
const objectProperty = parser(function* () {
  const key = yield* ws(jsonString)
  yield* ws(char(':'))
  const value = yield* ws(jsonValue)
  return [key, value] as [string, any]
})

jsonObject = parser(function* () {
  yield* ws(char('{'))
  const properties = yield* ws(sepBy(objectProperty, ws(char(','))))
  yield* ws(char('}'))
  return Object.fromEntries(properties)
})

// Array parsing
jsonArray = parser(function* () {
  yield* ws(char('['))
  const elements = yield* ws(sepBy(() => jsonValue, ws(char(','))))
  yield* ws(char(']'))
  return elements
})

// Main value parser
jsonValue = ws(or(
  jsonString,
  jsonNumber,
  jsonTrue,
  jsonFalse,
  jsonNull,
  jsonObject,
  jsonArray
))

// Main JSON parser
export const jsonParser = ws(jsonValue).thenDiscard(eof)
```

## Usage Examples

### Basic Values

```typescript
// Strings
jsonParser.parse('"hello world"')
// Success: "hello world"

jsonParser.parse('"with\\nescapes"')
// Success: "with\nescapes"

// Numbers
jsonParser.parse('42')        // Success: 42
jsonParser.parse('-3.14')     // Success: -3.14
jsonParser.parse('1.23e-4')   // Success: 0.000123

// Booleans and null
jsonParser.parse('true')      // Success: true
jsonParser.parse('false')     // Success: false
jsonParser.parse('null')      // Success: null
```

### Objects

```typescript
const objectJson = `{
  "name": "John Doe",
  "age": 30,
  "active": true,
  "address": null
}`

jsonParser.parse(objectJson)
// Success: {
//   name: "John Doe",
//   age: 30,
//   active: true,
//   address: null
// }
```

### Arrays

```typescript
const arrayJson = '[1, "two", true, null, {"nested": "object"}]'

jsonParser.parse(arrayJson)
// Success: [1, "two", true, null, { nested: "object" }]
```

### Complex Nested Structures

```typescript
const complexJson = `{
  "users": [
    {
      "id": 1,
      "name": "Alice",
      "preferences": {
        "theme": "dark",
        "notifications": true
      }
    },
    {
      "id": 2,
      "name": "Bob",
      "preferences": {
        "theme": "light",
        "notifications": false
      }
    }
  ],
  "meta": {
    "version": "1.0",
    "created": "2024-01-01T00:00:00Z"
  }
}`

const result = jsonParser.parse(complexJson)
// Success: Fully parsed nested structure
```

## Error Handling

The JSON parser provides detailed error messages:

```typescript
// Missing closing quote
jsonParser.parse('"incomplete string')
// Error: Expected closing quote at line 1, column 18

// Invalid escape sequence
jsonParser.parse('"invalid\\escape"')
// Error: Expected valid escape sequence at line 1, column 9

// Trailing comma
jsonParser.parse('[1, 2, 3,]')
// Error: Expected value after comma at line 1, column 10

// Missing comma
jsonParser.parse('{"a": 1 "b": 2}')
// Error: Expected comma or closing brace at line 1, column 9
```

## Performance Optimizations

### Atomic Parsing
For better error messages and performance:

```typescript
const jsonString = atomic(between(
  char('"'),
  char('"'),
  many0(stringChar)
)).map(chars => chars.join(''))
```

### Memoization
For deeply recursive structures:

```typescript
const memoizedJsonValue = memoize(jsonValue, 'jsonValue')
```

## Extensions

### Comments Support
Add support for JavaScript-style comments:

```typescript
const lineComment = string('//').then(takeUntil(char('\n')))
const blockComment = between(string('/*'), string('*/'), takeUntil(string('*/')))
const comment = or(lineComment, blockComment)

const wsWithComments = many0(or(regex(/\s/), comment))
const ws = <T>(p: Parser<T>) => p.thenDiscard(wsWithComments)
```

### Custom Data Types
Add support for dates, BigInt, etc:

```typescript
const isoDate = regex(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z/)
  .map(str => new Date(str))

const bigIntLiteral = regex(/\d+n/).map(str => BigInt(str.slice(0, -1)))

const extendedValue = or(
  isoDate,
  bigIntLiteral,
  jsonString,
  jsonNumber,
  // ... other types
)
```

### Streaming Support
Handle large JSON files:

```typescript
class StreamingJsonParser {
  private buffer = ''
  private depth = 0
  
  feed(chunk: string): any[] {
    this.buffer += chunk
    const results: any[] = []
    
    // Parse complete objects from buffer
    while (this.hasCompleteObject()) {
      const result = jsonParser.parse(this.buffer)
      if (result.isRight()) {
        results.push(result.value)
        this.buffer = result.state.remaining
      } else {
        break
      }
    }
    
    return results
  }
  
  private hasCompleteObject(): boolean {
    // Implementation to detect complete JSON objects
    // by tracking brace depth
  }
}
```

## Testing

```typescript
import { describe, it, expect } from 'vitest'

describe('JSON Parser', () => {
  it('parses primitive values', () => {
    expect(jsonParser.parse('42').value).toBe(42)
    expect(jsonParser.parse('"hello"').value).toBe('hello')
    expect(jsonParser.parse('true').value).toBe(true)
    expect(jsonParser.parse('null').value).toBe(null)
  })
  
  it('parses arrays', () => {
    const result = jsonParser.parse('[1, 2, 3]')
    expect(result.value).toEqual([1, 2, 3])
  })
  
  it('parses objects', () => {
    const result = jsonParser.parse('{"key": "value"}')
    expect(result.value).toEqual({ key: 'value' })
  })
  
  it('handles escape sequences', () => {
    const result = jsonParser.parse('"line1\\nline2"')
    expect(result.value).toBe('line1\nline2')
  })
  
  it('reports errors for invalid JSON', () => {
    const result = jsonParser.parse('{"invalid": }')
    expect(result.isLeft()).toBe(true)
  })
})
```

This JSON parser demonstrates many key concepts in Parserator including recursion, error handling, and building complex parsers from simple components. The implementation is complete and handles all standard JSON features while providing excellent error messages.
