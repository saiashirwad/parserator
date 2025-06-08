# Advanced Patterns

This guide covers advanced parsing patterns and techniques for building robust, efficient parsers with Parserator.

## Recursive Parsers

### Left Recursion Elimination
Handle left-recursive grammars by transforming them:

```typescript
import { parser, many0, string, char, alphabet, many1 } from 'parserator'

// Instead of: expr = expr '+' term | term (left recursive)
// Use: expr = term ('+' term)*

const identifier = many1(alphabet).map(chars => chars.join(''))
const number = many1(digit).map(digits => parseInt(digits.join('')))

const term = or(number, identifier)

const expression = parser(function* () {
  const first = yield* term
  const rest = yield* many0(parser(function* () {
    yield* char('+')
    return yield* term
  }))
  
  return rest.reduce((acc, val) => ({ type: 'add', left: acc, right: val }), first)
})
```

### Operator Precedence
Build expression parsers with proper precedence:

```typescript
const factor = or(
  number,
  between(char('('), char(')'), () => expression) // Forward reference
)

const term = parser(function* () {
  const first = yield* factor
  const rest = yield* many0(parser(function* () {
    const op = yield* or(char('*'), char('/'))
    const right = yield* factor
    return { op, right }
  }))
  
  return rest.reduce((left, {op, right}) => 
    ({ type: op === '*' ? 'mul' : 'div', left, right }), first)
})

const expression = parser(function* () {
  const first = yield* term
  const rest = yield* many0(parser(function* () {
    const op = yield* or(char('+'), char('-'))
    const right = yield* term
    return { op, right }
  }))
  
  return rest.reduce((left, {op, right}) => 
    ({ type: op === '+' ? 'add' : 'sub', left, right }), first)
})
```

## Context-Sensitive Parsing

### Stateful Parsers
Maintain state across parsing operations:

```typescript
class IndentationParser {
  private indentStack: number[] = [0]
  
  indent() {
    return parser<'INDENT' | 'DEDENT' | null>(state => {
      const currentIndent = this.measureIndent(state.remaining)
      const lastIndent = this.indentStack[this.indentStack.length - 1]
      
      if (currentIndent > lastIndent) {
        this.indentStack.push(currentIndent)
        return Parser.succeed('INDENT', state)
      } else if (currentIndent < lastIndent) {
        this.indentStack.pop()
        return Parser.succeed('DEDENT', state)
      }
      
      return Parser.succeed(null, state)
    })
  }
  
  private measureIndent(input: string): number {
    const match = input.match(/^( *)/)
    return match ? match[1].length : 0
  }
}
```

### Symbol Tables
Track variable declarations and usage:

```typescript
class ScopeParser {
  private scopes: Set<string>[] = [new Set()]
  
  declare(name: string) {
    this.scopes[this.scopes.length - 1].add(name)
  }
  
  isDeclared(name: string): boolean {
    return this.scopes.some(scope => scope.has(name))
  }
  
  enterScope() { this.scopes.push(new Set()) }
  exitScope() { this.scopes.pop() }
  
  variable() {
    return identifier.filter(name => {
      if (!this.isDeclared(name)) {
        throw new Error(`Undefined variable: ${name}`)
      }
      return true
    })
  }
}
```

## Performance Optimization

### Memoization
Cache parser results for expensive operations:

```typescript
class MemoizedParser<T> extends Parser<T> {
  private cache = new Map<string, any>()
  
  constructor(private baseParser: Parser<T>, private name: string) {
    super(state => this.runMemoized(state))
  }
  
  private runMemoized(state: ParserState) {
    const key = `${this.name}:${state.pos.offset}`
    
    if (this.cache.has(key)) {
      return this.cache.get(key)
    }
    
    const result = this.baseParser.run(state)
    this.cache.set(key, result)
    return result
  }
}

const memoize = <T>(parser: Parser<T>, name: string) => 
  new MemoizedParser(parser, name)
```

### Atomic Parsing
Use atomic parsers to reduce backtracking:

```typescript
import { atomic, or, string } from 'parserator'

// Without atomic: tries "function" fully, backtracks, tries "fun"
const keyword = or(
  string("function"),
  string("fun")
)

// With atomic: either matches "function" completely or fails immediately
const atomicKeyword = or(
  atomic(string("function")),
  atomic(string("fun"))
)
```

## Error Recovery

### Synchronization Points
Add recovery points in your grammar:

```typescript
const statement = or(
  ifStatement,
  whileStatement,
  assignment,
  errorRecovery // Fallback parser
)

const errorRecovery = parser(function* () {
  // Skip until we find a semicolon or newline
  yield* skipUntil(or(char(';'), char('\n')))
  yield* optional(or(char(';'), char('\n')))
  
  return { type: 'error', recovered: true }
})

const program = many0(statement).map(statements => 
  statements.filter(stmt => stmt.type !== 'error')
)
```

### Partial Results
Return partial results even when parsing fails:

```typescript
const robustObjectParser = parser(function* () {
  yield* char('{')
  const properties: any[] = []
  
  while (true) {
    const result = yield* optional(property)
    if (!result) break
    
    properties.push(result)
    
    const separator = yield* optional(char(','))
    if (!separator) break
  }
  
  yield* char('}').optional() // Don't fail if missing closing brace
  
  return { type: 'object', properties, complete: true }
})
```

## Streaming and Incremental Parsing

### Chunk Processing
Handle large inputs by processing in chunks:

```typescript
class StreamingParser<T> {
  private buffer = ''
  private results: T[] = []
  
  feed(chunk: string): T[] {
    this.buffer += chunk
    const newResults: T[] = []
    
    while (this.buffer.length > 0) {
      const result = this.parser.parse(this.buffer)
      
      if (result.isLeft()) {
        break // Need more input
      }
      
      newResults.push(result.value)
      this.buffer = result.state.remaining
    }
    
    this.results.push(...newResults)
    return newResults
  }
  
  constructor(private parser: Parser<T>) {}
}
```

### Incremental Updates
Parse only changed portions of input:

```typescript
class IncrementalParser {
  private parseTree: any[] = []
  private input = ''
  
  update(newInput: string, changeStart: number, changeEnd: number) {
    this.input = newInput
    
    // Find affected nodes
    const affectedStart = this.findNodeAt(changeStart)
    const affectedEnd = this.findNodeAt(changeEnd)
    
    // Reparse only the affected region
    const reparsedSection = this.parseRange(affectedStart, affectedEnd)
    
    // Update parse tree
    this.parseTree.splice(affectedStart, affectedEnd - affectedStart + 1, ...reparsedSection)
  }
  
  private findNodeAt(position: number): number {
    // Implementation to find parse tree node at position
  }
  
  private parseRange(start: number, end: number): any[] {
    // Implementation to reparse a specific range
  }
}
```

## Testing Patterns

### Property-Based Testing
Test parser properties rather than specific cases:

```typescript
import { property, fc } from 'fast-check'

// Test that parsing then stringifying gives original input
property(fc.string().filter(s => isValidInput(s)), input => {
  const result = myParser.parse(input)
  if (result.isRight()) {
    const stringified = stringify(result.value)
    return stringified === input
  }
  return true // Ignore parse failures for this property
})

// Test parser composition properties
property(fc.array(fc.string()), strings => {
  const concatenated = strings.join('')
  const individualResults = strings.map(s => myParser.parse(s))
  const combinedResult = myParser.parse(concatenated)
  
  // Property: parsing concatenated should equal parsing individually
  // (for some parsers)
})
```

### Fuzzing
Test with random inputs to find edge cases:

```typescript
function fuzzTest(parser: Parser<any>, iterations = 1000) {
  for (let i = 0; i < iterations; i++) {
    const randomInput = generateRandomInput()
    
    try {
      const result = parser.parse(randomInput)
      // Parser should either succeed or fail gracefully
      if (result.isLeft()) {
        // Verify error is well-formed
        assert(result.error.message.length > 0)
        assert(result.error.pos.offset >= 0)
      }
    } catch (error) {
      // Parser should never throw unexpected exceptions
      console.error(`Parser threw on input: ${randomInput}`)
      throw error
    }
  }
}
```

## Domain-Specific Languages

### Configuration Languages
Build parsers for config files:

```typescript
const configParser = parser(function* () {
  const entries = yield* many0(parser(function* () {
    yield* skipSpaces
    const key = yield* identifier
    yield* skipSpaces
    yield* char('=')
    yield* skipSpaces
    const value = yield* or(stringLiteral, numberLiteral, booleanLiteral)
    yield* skipSpaces
    yield* optional(char('\n'))
    return { key, value }
  }))
  
  return Object.fromEntries(entries.map(e => [e.key, e.value]))
})
```

### Template Languages
Parse template syntax:

```typescript
const templateParser = parser(function* () {
  const parts = yield* many0(or(
    // Text content
    takeUntil(string('{{')).map(text => ({ type: 'text', content: text })),
    
    // Variables
    parser(function* () {
      yield* string('{{')
      yield* skipSpaces
      const name = yield* identifier
      yield* skipSpaces
      yield* string('}}')
      return { type: 'variable', name }
    }),
    
    // Any remaining character
    anyChar().map(char => ({ type: 'text', content: char }))
  ))
  
  return parts
})
```

## Next Steps

- Explore the [Examples](/examples/) for complete implementations
- Check the [API Reference](/api/) for all available combinators
- See the source code for advanced usage patterns
