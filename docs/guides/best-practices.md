# Best Practices

This guide covers best practices for designing, implementing, and maintaining parsers with Parserator. Following these guidelines will help you create robust, maintainable, and performant parsers.

## Parser Design Principles

### 1. Start Simple, Build Up

Begin with the simplest possible parser and gradually add complexity:

```typescript
// ❌ Don't start with everything at once
const complexParser = Parser.gen(function* () {
  // 200 lines of complex logic
})

// ✅ Start simple and compose
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/)
const number = regex(/\d+/).map(s => parseInt(s))
const expression = or(identifier, number, /* add more later */)
```

### 2. Use Meaningful Names

Give your parsers descriptive names that explain what they parse:

```typescript
// ❌ Unclear names
const p1 = regex(/\d+/)
const p2 = char(',')
const p3 = sepBy(p2, p1)

// ✅ Clear, descriptive names
const integer = regex(/\d+/).map(s => parseInt(s))
const comma = char(',')
const integerList = sepBy(comma, integer)
```

### 3. Define Clear Grammar

Document your grammar before implementing:

```
// Grammar for arithmetic expressions:
// expression ::= term (('+' | '-') term)*
// term       ::= factor (('*' | '/') factor)*
// factor     ::= number | '(' expression ')'
// number     ::= [0-9]+
```

Then implement following the grammar structure:

```typescript
let expression: Parser<number>

const number = regex(/\d+/).map(s => parseInt(s))

const factor = or(
  number,
  between(char('('), char(')'), Parser.lazy(() => expression))
)

const term = chainLeft(factor, or(char('*'), char('/')))
const expression = chainLeft(term, or(char('+'), char('-')))
```

## Error Handling

### 1. Provide Meaningful Error Messages

Use `.withError()` and `.label()` to create helpful error messages:

```typescript
// ❌ Generic error
const bad = regex(/\d+/)

// ✅ Helpful error message
const number = regex(/\d+/)
  .withError(() => "Expected a positive integer")
  .label("number")

const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/)
  .withError(() => "Expected an identifier (letters, digits, underscore)")
  .label("identifier")
```

### 2. Use Labels Consistently

Create a consistent labeling strategy:

```typescript
// Language constructs
const keyword = (word: string) => 
  string(word).thenDiscard(notFollowedBy(alphanumeric)).label(`keyword '${word}'`)

const operator = (op: string) => 
  string(op).label(`operator '${op}'`)

// Data types
const stringLiteral = between(char('"'), char('"'), many0(stringChar))
  .label("string literal")

const numberLiteral = regex(/\d+(\.\d+)?/)
  .map(parseFloat)
  .label("number literal")
```

### 3. Handle Edge Cases

Always consider and test edge cases:

```typescript
const robustNumber = Parser.gen(function* () {
  const sign = yield* optional(char('-'))
  const digits = yield* many1(digit)
  
  // Handle edge case: just a minus sign
  if (digits.length === 0) {
    return yield* Parser.error("Expected digits after minus sign")
  }
  
  const value = parseInt(digits.join(''))
  return sign ? -value : value
})
```

## Performance Optimization

### 1. Reuse Parser Instances

Create parsers once and reuse them:

```typescript
// ❌ Creates new parser each time
function parseArray<T>(elementParser: () => Parser<T>) {
  return between(char('['), char(']'), sepBy(char(','), elementParser()))
}

// ✅ Reuses parser instance
function parseArray<T>(elementParser: Parser<T>) {
  return between(char('['), char(']'), sepBy(char(','), elementParser))
}

// Even better - create once, use many times
const intArray = parseArray(integer)
const stringArray = parseArray(stringLiteral)
```

### 2. Order Choices Efficiently

Put more likely or longer alternatives first in `or`:

```typescript
// ❌ Short matches first can prevent longer matches
const bad = or(
  string('if'),
  string('import'),     // Will never match because 'if' matches 'import'
  string('interface')
)

// ✅ Longer matches first
const good = or(
  string('interface'),
  string('import'),
  string('if')
)

// ✅ Or use notFollowedBy for exact matching
const keyword = (word: string) => 
  string(word).thenDiscard(notFollowedBy(alphanumeric))

const keywords = or(
  keyword('if'),
  keyword('import'),
  keyword('interface')
)
```

### 3. Use Specific Parsers

Prefer specific parsers over general ones when possible:

```typescript
// ❌ Less efficient
const slow = regex(/./).flatMap(c => 
  c === 'a' ? Parser.pure('a') : Parser.error('Expected a')
)

// ✅ More efficient
const fast = char('a')
```

### 4. Minimize Backtracking

Design your grammar to avoid backtracking:

```typescript
// ❌ Requires backtracking
const ambiguous = or(
  string('function').then(string('Type')),
  string('function').then(string('Call'))
)

// ✅ Factor out common prefix
const better = string('function').then(or(
  string('Type'),
  string('Call')
))
```

## Code Organization

### 1. Group Related Parsers

Organize parsers by functionality:

```typescript
// Lexical parsers
const whitespace = regex(/\s+/)
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/)
const stringLiteral = between(char('"'), char('"'), many0(stringChar))
const numberLiteral = regex(/\d+(\.\d+)?/).map(parseFloat)

// Expression parsers
const primary = or(identifier, stringLiteral, numberLiteral)
const call = primary.then(optional(argumentList))
const unary = or(char('!').then(call), call)
// ... rest of expression hierarchy

// Statement parsers
const assignment = identifier.then(char('=')).then(expression)
const ifStatement = keyword('if').then(expression).then(block)
const whileStatement = keyword('while').then(expression).then(block)
```

### 2. Create Parser Libraries

Build reusable parser components:

```typescript
// utils/common-parsers.ts
export const whitespace = regex(/\s*/)
export const token = <T>(p: Parser<T>) => p.thenDiscard(whitespace)
export const keyword = (word: string) => 
  token(string(word).thenDiscard(notFollowedBy(alphanumeric)))

// utils/json-parsers.ts
export const jsonString = token(between(char('"'), char('"'), stringContent))
export const jsonNumber = token(regex(/-?\d+(\.\d+)?([eE][+-]?\d+)?/))

// main-parser.ts
import { whitespace, token, keyword } from './utils/common-parsers'
import { jsonString, jsonNumber } from './utils/json-parsers'
```

### 3. Use TypeScript Effectively

Leverage TypeScript for better type safety:

```typescript
// Define your AST types clearly
interface Expression {
  type: 'expression'
  value: number | string | boolean
}

interface Statement {
  type: 'assignment' | 'if' | 'while'
  // ... other properties
}

// Use discriminated unions
type ASTNode = Expression | Statement

// Make your parsers type-safe
const expressionParser: Parser<Expression> = or(
  numberLiteral.map(value => ({ type: 'expression' as const, value })),
  stringLiteral.map(value => ({ type: 'expression' as const, value })),
  booleanLiteral.map(value => ({ type: 'expression' as const, value }))
)
```

## Testing Strategies

### 1. Test at Multiple Levels

Test individual parsers and compositions:

```typescript
describe('Number Parser', () => {
  test('parses positive integers', () => {
    expect(numberParser.parseOrThrow('123')).toBe(123)
  })
  
  test('parses negative integers', () => {
    expect(numberParser.parseOrThrow('-456')).toBe(-456)
  })
  
  test('parses decimals', () => {
    expect(numberParser.parseOrThrow('3.14')).toBe(3.14)
  })
  
  test('fails on invalid input', () => {
    expect(() => numberParser.parseOrThrow('abc')).toThrow()
  })
})

describe('Expression Parser', () => {
  test('parses simple arithmetic', () => {
    expect(expressionParser.parseOrThrow('2 + 3')).toEqual({
      type: 'binary',
      operator: '+',
      left: { type: 'literal', value: 2 },
      right: { type: 'literal', value: 3 }
    })
  })
})
```

### 2. Test Error Cases

Verify error messages are helpful:

```typescript
test('provides helpful error for missing closing paren', () => {
  const result = expressionParser.parse('(2 + 3')
  expect(result.result._tag).toBe('Left')
  
  if (Either.isLeft(result.result)) {
    const error = result.result.left
    expect(error.primary.message).toContain('closing parenthesis')
  }
})
```

### 3. Test Edge Cases

Include boundary conditions:

```typescript
test('handles empty input', () => {
  const result = optionalParser.parseOrThrow('')
  expect(result).toBeUndefined()
})

test('handles very long input', () => {
  const longString = 'a'.repeat(10000)
  expect(manyAParser.parseOrThrow(longString)).toHaveLength(10000)
})
```

### 4. Property-Based Testing

Use property-based testing for robust validation:

```typescript
import { fc } from 'fast-check'

test('number parser round-trips', () => {
  fc.assert(fc.property(fc.integer(), (num) => {
    const str = num.toString()
    const parsed = numberParser.parseOrThrow(str)
    expect(parsed).toBe(num)
  }))
})
```

## Debugging Techniques

### 1. Use Debug Utilities

Leverage Parserator's debug features:

```typescript
import { debug, trace } from 'parserator'

const debuggedParser = debug(
  myComplexParser,
  'complex-parser'
).tap(({ state, result }) => {
  console.log('Position:', state.pos)
  console.log('Remaining:', state.remaining.slice(0, 20))
})
```

### 2. Add Tracing Points

Insert trace points at key locations:

```typescript
const tracedParser = Parser.gen(function* () {
  yield* trace('Starting expression parsing')
  const left = yield* term
  
  yield* trace('Parsed left term')
  const op = yield* operator
  
  yield* trace('Parsed operator')
  const right = yield* term
  
  yield* trace('Completed expression')
  return { left, op, right }
})
```

### 3. Test Incrementally

Build and test parsers incrementally:

```typescript
// Start with basics
const simpleNumber = regex(/\d+/)
console.log(simpleNumber.parseOrThrow('123'))

// Add complexity step by step
const signedNumber = optional(char('-')).then(simpleNumber)
console.log(signedNumber.parseOrThrow('-123'))

// Continue building up
const decimal = signedNumber.then(optional(char('.').then(regex(/\d+/))))
// ... etc
```

## Documentation Practices

### 1. Document Grammar

Include grammar documentation with your parser:

```typescript
/**
 * Parses JSON values according to RFC 7159
 * 
 * Grammar:
 *   value     ::= object | array | string | number | boolean | null
 *   object    ::= '{' (string ':' value (',' string ':' value)*)? '}'
 *   array     ::= '[' (value (',' value)*)? ']'
 *   string    ::= '"' char* '"'
 *   number    ::= '-'? ('0' | [1-9] digit*) ('.' digit+)? ([eE] [+-]? digit+)?
 *   boolean   ::= 'true' | 'false'
 *   null      ::= 'null'
 */
export const jsonParser = /* implementation */
```

### 2. Provide Examples

Include usage examples:

```typescript
/**
 * Parses CSS selectors
 * 
 * @example
 * ```typescript
 * cssSelector.parseOrThrow('.class#id')        // { class: 'class', id: 'id' }
 * cssSelector.parseOrThrow('div > p')          // { element: 'div', child: 'p' }
 * cssSelector.parseOrThrow('[attr="value"]')   // { attribute: 'attr', value: 'value' }
 * ```
 */
export const cssSelector = /* implementation */
```

### 3. Document Error Conditions

Explain when parsers fail:

```typescript
/**
 * Parses email addresses (simplified)
 * 
 * @throws {ParseError} When input doesn't contain '@' symbol
 * @throws {ParseError} When domain part is missing
 * @throws {ParseError} When local part contains invalid characters
 */
export const emailParser = /* implementation */
```

## Common Anti-Patterns

### 1. Over-Engineering

Don't make parsers more complex than needed:

```typescript
// ❌ Over-engineered for simple use case
const overEngineered = Parser.gen(function* () {
  const state = yield* getParserState
  const context = createParsingContext(state)
  const validator = new InputValidator(context)
  // ... 50 more lines
})

// ✅ Simple and direct
const simple = regex(/\d+/).map(s => parseInt(s))
```

### 2. Ignoring Error Quality

Don't neglect error messages:

```typescript
// ❌ Poor error experience
const bad = regex(/\d+/)

// ✅ User-friendly errors
const good = regex(/\d+/)
  .withError(() => "Expected a number")
  .label("number")
```

### 3. Premature Optimization

Don't optimize before measuring:

```typescript
// ❌ Premature optimization
const premature = /* complex optimized parser that's hard to understand */

// ✅ Clear first, optimize if needed
const clear = /* simple, readable parser */
// Profile, then optimize if performance is actually a problem
```

## Migration and Maintenance

### 1. Version Your Grammar

Track grammar changes over time:

```typescript
// v1.0: Simple arithmetic
// expression ::= term (('+' | '-') term)*

// v1.1: Added multiplication
// expression ::= term (('+' | '-') term)*
// term       ::= factor (('*' | '/') factor)*

// v2.0: Added functions (breaking change)
// expression ::= term (('+' | '-') term)*
// term       ::= factor (('*' | '/') factor)*
// factor     ::= number | identifier '(' args ')' | '(' expression ')'
```

### 2. Maintain Backwards Compatibility

When possible, support old formats:

```typescript
const configParser = or(
  newConfigFormat,
  oldConfigFormat.map(convertToNewFormat)
).label("configuration")
```

### 3. Deprecate Gracefully

Provide migration paths:

```typescript
/**
 * @deprecated Use newParser instead. Will be removed in v3.0
 */
export const oldParser = newParser.tap(() => {
  console.warn('oldParser is deprecated, use newParser instead')
})
```

## Summary

Following these best practices will help you:

- **Write maintainable code**: Clear structure and documentation
- **Create robust parsers**: Good error handling and edge case coverage
- **Achieve good performance**: Efficient parser design and reuse
- **Enable easy debugging**: Proper tooling and incremental development
- **Facilitate team collaboration**: Consistent patterns and documentation

Remember: start simple, test thoroughly, and optimize when needed. The best parser is one that correctly handles your input and provides clear feedback when it doesn't.

## See Also

- [Testing Guide](./testing.md) - Comprehensive testing strategies
- [Performance Tips](../advanced/performance.md) - Advanced optimization techniques
- [Error Handling](../api/error-handling.md) - Detailed error management
- [Examples](../examples/) - Real-world implementations