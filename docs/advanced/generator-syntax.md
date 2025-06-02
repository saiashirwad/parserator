# Generator Syntax

Parserator supports JavaScript generator syntax for creating parsers in an imperative style. This can make complex parsers much more readable and easier to reason about than traditional combinator chains.

## Overview

Generator syntax allows you to write parsers that look like regular imperative code, using `yield*` to run sub-parsers and regular variable assignments to capture results.

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

## Basic Generator Syntax

### `Parser.gen(function* () { ... })`

Creates a parser from a generator function:

```typescript
const parser = Parser.gen(function* () {
  // Parser logic here
  return result
})
```

### `yield* parser`

Runs a parser and returns its result:

```typescript
const greeting = Parser.gen(function* () {
  const hello = yield* string('Hello')  // Run parser, get result
  yield* char(' ')                      // Run parser, ignore result
  const world = yield* string('World')  // Run parser, get result
  
  return `${hello} ${world}`
})
```

### Error Handling

If any parser fails, the entire generator stops and propagates the error:

```typescript
const parser = Parser.gen(function* () {
  const a = yield* char('a')  // If this fails, generator stops
  const b = yield* char('b')  // This won't run if 'a' fails
  return a + b
})
```

## Conditional Parsing

Generator syntax makes conditional parsing natural:

```typescript
const numberOrString = Parser.gen(function* () {
  const first = yield* anyChar()
  
  if (first >= '0' && first <= '9') {
    // Parse as number
    const rest = yield* many0(digit)
    return parseInt(first + rest.join(''))
  } else if (first === '"') {
    // Parse as quoted string
    const content = yield* takeUntil(char('"'))
    yield* char('"')
    return content
  } else {
    return yield* Parser.error('Expected number or string')
  }
})
```

## Loops and Repetition

Use regular JavaScript loops for complex repetition patterns:

```typescript
const csvRow = Parser.gen(function* () {
  const fields: string[] = []
  
  while (true) {
    const field = yield* takeUntil(or(char(','), char('\n')))
    fields.push(field)
    
    const separator = yield* optional(char(','))
    if (!separator) break
  }
  
  return fields
})
```

### Parsing Lists with Custom Logic

```typescript
const smartList = Parser.gen(function* () {
  const items: number[] = []
  let expectingItem = true
  
  while (true) {
    yield* skipSpaces
    
    if (expectingItem) {
      const num = yield* many1(digit).map(d => parseInt(d.join('')))
      items.push(num)
      expectingItem = false
    }
    
    yield* skipSpaces
    const separator = yield* optional(or(char(','), char(';')))
    
    if (!separator) break
    expectingItem = true
  }
  
  return items
})

// Parses: "1, 2; 3, 4" -> [1, 2, 3, 4]
```

## Complex State Management

Generators can maintain complex state during parsing:

```typescript
interface ParserState {
  variables: Map<string, number>
  functions: Map<string, (args: number[]) => number>
}

const calculator = Parser.gen(function* () {
  const state: ParserState = {
    variables: new Map(),
    functions: new Map([
      ['add', (args) => args.reduce((a, b) => a + b, 0)],
      ['mul', (args) => args.reduce((a, b) => a * b, 1)]
    ])
  }
  
  const statements: any[] = []
  
  while (true) {
    yield* skipSpaces
    
    const lookahead = yield* optional(anyChar())
    if (!lookahead) break
    
    if (lookahead === 'l') {
      // Parse let statement: let x = 5
      yield* string('let ')
      const name = yield* many1(alphabet).map(chars => chars.join(''))
      yield* string(' = ')
      const value = yield* parseExpression(state)
      state.variables.set(name, value)
      statements.push({ type: 'let', name, value })
    } else {
      // Parse expression
      const result = yield* parseExpression(state)
      statements.push({ type: 'expression', value: result })
    }
    
    yield* optional(char('\n'))
  }
  
  return statements
})
```

## Error Recovery

Generators make error recovery strategies easier to implement:

```typescript
const robustParser = Parser.gen(function* () {
  const results: any[] = []
  
  while (true) {
    yield* skipSpaces
    
    try {
      const statement = yield* parseStatement()
      results.push({ success: true, value: statement })
    } catch (error) {
      // Skip to next semicolon and continue
      yield* skipUntil(char(';'))
      yield* char(';')
      results.push({ success: false, error: error.message })
    }
    
    const hasMore = yield* optional(anyChar())
    if (!hasMore) break
  }
  
  return results
})
```

## Recursive Parsers

Use generators for recursive structures:

```typescript
// Forward declaration
let expression: Parser<any>

const factor = Parser.gen(function* () {
  const lookahead = yield* lookAhead(anyChar())
  
  if (lookahead === '(') {
    yield* char('(')
    const expr = yield* Parser.lazy(() => expression)
    yield* char(')')
    return expr
  } else {
    return yield* many1(digit).map(d => parseInt(d.join('')))
  }
})

const term = Parser.gen(function* () {
  let result = yield* factor
  
  while (true) {
    yield* skipSpaces
    const op = yield* optional(or(char('*'), char('/')))
    if (!op) break
    
    yield* skipSpaces
    const right = yield* factor
    
    if (op === '*') {
      result = result * right
    } else {
      result = Math.floor(result / right)
    }
  }
  
  return result
})

expression = Parser.gen(function* () {
  let result = yield* term
  
  while (true) {
    yield* skipSpaces
    const op = yield* optional(or(char('+'), char('-')))
    if (!op) break
    
    yield* skipSpaces
    const right = yield* term
    
    if (op === '+') {
      result = result + right
    } else {
      result = result - right
    }
  }
  
  return result
})
```

## Debugging Generators

Add debug information to generator parsers:

```typescript
const debugParser = Parser.gen(function* () {
  console.log('Starting parser')
  
  const a = yield* char('a').tap(() => console.log('Parsed a'))
  console.log('Got a:', a)
  
  const b = yield* char('b').tap(() => console.log('Parsed b'))
  console.log('Got b:', b)
  
  const result = a + b
  console.log('Final result:', result)
  
  return result
})
```

## Performance Considerations

### Generator vs Combinator Performance

Generators add some overhead:

```typescript
// Faster - direct combinator chain
const fast = string('hello').then(char(' ')).then(string('world'))

// Slower - generator syntax
const slow = Parser.gen(function* () {
  yield* string('hello')
  yield* char(' ')
  return yield* string('world')
})
```

### When to Use Generators

Use generators when:
- **Complex logic**: Conditionals, loops, state management
- **Readability**: Complex combinators become hard to follow
- **Error recovery**: Need sophisticated error handling
- **Debugging**: Need to inspect intermediate values

Avoid generators for:
- **Simple parsers**: Basic token recognition
- **Performance-critical code**: Hot parsing loops
- **Library APIs**: Combinators are more composable

## Advanced Patterns

### Parser Factories

Create parser generators that take parameters:

```typescript
function createLanguageParser(config: LanguageConfig) {
  return Parser.gen(function* () {
    const keywords = new Set(config.keywords)
    const operators = new Map(config.operators)
    
    // Parse using configuration
    while (true) {
      const token = yield* parseToken(keywords, operators)
      // ... rest of parsing logic
    }
  })
}

const jsParser = createLanguageParser({
  keywords: ['function', 'const', 'let', 'var'],
  operators: [['+', 'add'], ['-', 'subtract']]
})
```

### Streaming Parsers

Process input incrementally:

```typescript
function* parseJsonStream(input: string) {
  let position = 0
  
  while (position < input.length) {
    const remaining = input.slice(position)
    const result = yield* jsonValue.parse(remaining)
    
    yield result.value
    position += result.consumed
    
    // Skip whitespace and optional comma
    while (position < input.length && /\s|,/.test(input[position])) {
      position++
    }
  }
}
```

### Context-Aware Parsing

Pass context through the generator:

```typescript
interface ParseContext {
  indentLevel: number
  inFunction: boolean
  variables: Set<string>
}

const pythonParser = Parser.gen(function* () {
  const context: ParseContext = {
    indentLevel: 0,
    inFunction: false,
    variables: new Set()
  }
  
  return yield* parseBlock(context)
})

function parseBlock(context: ParseContext) {
  return Parser.gen(function* () {
    const statements = []
    
    while (true) {
      const indent = yield* parseIndentation()
      if (indent !== context.indentLevel) break
      
      const stmt = yield* parseStatement({
        ...context,
        indentLevel: indent
      })
      
      statements.push(stmt)
    }
    
    return statements
  })
}
```

## Best Practices

### 1. Keep Generators Focused

```typescript
// ❌ Bad - too much in one generator
const megaParser = Parser.gen(function* () {
  // 100+ lines of parsing logic
})

// ✅ Good - break into smaller pieces
const expressionParser = Parser.gen(function* () {
  return yield* parseExpression()
})

const statementParser = Parser.gen(function* () {
  return yield* parseStatement()
})

const programParser = Parser.gen(function* () {
  const statements = []
  while (true) {
    const stmt = yield* optional(statementParser)
    if (!stmt) break
    statements.push(stmt)
  }
  return statements
})
```

### 2. Use Type Annotations

```typescript
const typedParser = Parser.gen<MyResultType>(function* () {
  // TypeScript can better infer types with explicit return type
  const result: MyResultType = yield* someParser
  return result
})
```

### 3. Handle Errors Gracefully

```typescript
const safeParser = Parser.gen(function* () {
  const result = yield* risky Parser.withError(() => 'Expected something important')
  return result
})
```

### 4. Document Complex Logic

```typescript
const complexParser = Parser.gen(function* () {
  // Parse function declaration
  yield* string('function')
  yield* whitespace
  
  // Function name is optional for anonymous functions
  const name = yield* optional(identifier)
  
  // Parameter list
  yield* char('(')
  const params = yield* sepBy(char(','), identifier)
  yield* char(')')
  
  // Function body
  const body = yield* block
  
  return { type: 'function', name, params, body }
})
```

## Common Pitfalls

### 1. Forgetting `yield*`

```typescript
// ❌ Wrong - missing yield*
const bad = Parser.gen(function* () {
  const result = char('a')  // Returns a parser, not the result
  return result
})

// ✅ Correct
const good = Parser.gen(function* () {
  const result = yield* char('a')  // Runs parser, returns result
  return result
})
```

### 2. Using `yield` Instead of `yield*`

```typescript
// ❌ Wrong - yield creates a generator
const bad = Parser.gen(function* () {
  const result = yield char('a')
  return result
})

// ✅ Correct - yield* delegates to the parser
const good = Parser.gen(function* () {
  const result = yield* char('a')
  return result
})
```

### 3. Not Handling Parser Failures

```typescript
// ❌ Risky - any failure stops everything
const risky = Parser.gen(function* () {
  const a = yield* char('a')  // If this fails, no recovery
  const b = yield* char('b')
  return a + b
})

// ✅ Better - handle optional parts
const safe = Parser.gen(function* () {
  const a = yield* char('a')
  const b = yield* optional(char('b'))
  return a + (b || '')
})
```

## See Also

- [Parser Class API](../api/parser.md) - Core parser methods
- [Combinators API](../api/combinators.md) - Building block functions
- [Examples](../examples/) - Real-world generator usage
- [Best Practices](../guides/best-practices.md) - General parsing guidelines