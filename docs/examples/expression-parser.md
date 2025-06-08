# Expression Parser Example

This example shows how to build a mathematical expression parser with proper operator precedence, associativity, and support for functions and variables.

## Grammar

Our expression language supports:
- Numbers: `42`, `3.14`, `-17`
- Variables: `x`, `foo`, `PI`
- Binary operators: `+`, `-`, `*`, `/`, `^` (power)
- Unary operators: `-`, `+`
- Function calls: `sin(x)`, `max(a, b, c)`
- Parentheses for grouping: `(2 + 3) * 4`

## Implementation

```typescript
import { 
  parser, char, string, or, many0, many1, between, sepBy, 
  optional, digit, alphabet, regex, skipSpaces 
} from 'parserator'

// Whitespace handling
const ws = regex(/\s*/)
const lexeme = <T>(p: Parser<T>) => p.thenDiscard(ws)

// Numbers
const number = parser(function* () {
  const sign = yield* optional(or(char('-'), char('+')))
  const integer = yield* many1(digit)
  const decimal = yield* optional(char('.').then(many1(digit)))
  
  const numStr = (sign === '-' ? '-' : '') + 
                 integer.join('') + 
                 (decimal ? '.' + decimal.join('') : '')
  
  return parseFloat(numStr)
})

// Variables and function names
const identifier = many1(or(alphabet, char('_')))
  .map(chars => chars.join(''))

// Forward declaration for recursive expressions
let expression: Parser<Expression>

// Expression AST types
type Expression = 
  | { type: 'number', value: number }
  | { type: 'variable', name: string }
  | { type: 'unary', operator: string, operand: Expression }
  | { type: 'binary', operator: string, left: Expression, right: Expression }
  | { type: 'call', name: string, args: Expression[] }

// Primary expressions (highest precedence)
const primary: Parser<Expression> = or(
  // Numbers
  lexeme(number).map(value => ({ type: 'number', value })),
  
  // Function calls or variables
  parser(function* () {
    const name = yield* lexeme(identifier)
    
    // Check if it's a function call
    const openParen = yield* optional(lexeme(char('(')))
    if (openParen) {
      const args = yield* sepBy(
        () => expression, 
        lexeme(char(','))
      )
      yield* lexeme(char(')'))
      return { type: 'call', name, args }
    }
    
    // It's a variable
    return { type: 'variable', name }
  }),
  
  // Parenthesized expressions
  between(
    lexeme(char('(')),
    lexeme(char(')')),
    () => expression
  )
)

// Unary expressions
const unary: Parser<Expression> = or(
  parser(function* () {
    const operator = yield* lexeme(or(char('-'), char('+')))
    const operand = yield* unary
    return { type: 'unary', operator, operand }
  }),
  primary
)

// Helper for left-associative binary operators
function leftAssoc(
  operandParser: Parser<Expression>, 
  operatorParser: Parser<string>
): Parser<Expression> {
  return parser(function* () {
    const first = yield* operandParser
    const rest = yield* many0(parser(function* () {
      const op = yield* operatorParser
      const right = yield* operandParser
      return { op, right }
    }))
    
    return rest.reduce((left, { op, right }) => ({
      type: 'binary',
      operator: op,
      left,
      right
    }), first)
  })
}

// Helper for right-associative binary operators
function rightAssoc(
  operandParser: Parser<Expression>,
  operatorParser: Parser<string>
): Parser<Expression> {
  return parser(function* () {
    const first = yield* operandParser
    const rest = yield* optional(parser(function* () {
      const op = yield* operatorParser
      const right = yield* rightAssoc(operandParser, operatorParser)
      return { op, right }
    }))
    
    if (rest) {
      return {
        type: 'binary',
        operator: rest.op,
        left: first,
        right: rest.right
      }
    }
    
    return first
  })
}

// Power (right-associative: 2^3^4 = 2^(3^4))
const power = rightAssoc(
  unary,
  lexeme(char('^'))
)

// Multiplication and division (left-associative)
const term = leftAssoc(
  power,
  lexeme(or(char('*'), char('/')))
)

// Addition and subtraction (left-associative)
expression = leftAssoc(
  term,
  lexeme(or(char('+'), char('-')))
)

// Main parser
export const expressionParser = lexeme(expression).thenDiscard(eof)
```

## Evaluation

```typescript
// Environment for variables and functions
type Environment = {
  variables: Record<string, number>
  functions: Record<string, (...args: number[]) => number>
}

const defaultEnv: Environment = {
  variables: {
    PI: Math.PI,
    E: Math.E
  },
  functions: {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    sqrt: Math.sqrt,
    abs: Math.abs,
    log: Math.log,
    exp: Math.exp,
    max: Math.max,
    min: Math.min,
    pow: Math.pow,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round
  }
}

function evaluate(expr: Expression, env: Environment = defaultEnv): number {
  switch (expr.type) {
    case 'number':
      return expr.value
      
    case 'variable':
      if (!(expr.name in env.variables)) {
        throw new Error(`Undefined variable: ${expr.name}`)
      }
      return env.variables[expr.name]
      
    case 'unary':
      const operand = evaluate(expr.operand, env)
      switch (expr.operator) {
        case '+': return operand
        case '-': return -operand
        default: throw new Error(`Unknown unary operator: ${expr.operator}`)
      }
      
    case 'binary':
      const left = evaluate(expr.left, env)
      const right = evaluate(expr.right, env)
      switch (expr.operator) {
        case '+': return left + right
        case '-': return left - right
        case '*': return left * right
        case '/': 
          if (right === 0) throw new Error('Division by zero')
          return left / right
        case '^': return Math.pow(left, right)
        default: throw new Error(`Unknown binary operator: ${expr.operator}`)
      }
      
    case 'call':
      if (!(expr.name in env.functions)) {
        throw new Error(`Undefined function: ${expr.name}`)
      }
      const args = expr.args.map(arg => evaluate(arg, env))
      return env.functions[expr.name](...args)
      
    default:
      throw new Error('Unknown expression type')
  }
}
```

## Usage Examples

### Basic Arithmetic

```typescript
const calc = (input: string) => {
  const result = expressionParser.parse(input)
  if (result.isLeft()) {
    throw new Error(result.error.message)
  }
  return evaluate(result.value)
}

calc('2 + 3 * 4')        // 14
calc('(2 + 3) * 4')      // 20
calc('2^3^2')            // 512 (right-associative: 2^(3^2))
calc('-3 + 4')           // 1
calc('10 / 2 / 5')       // 1 (left-associative: (10/2)/5)
```

### Variables and Functions

```typescript
calc('PI * 2')           // ~6.28
calc('sin(PI/2)')        // 1
calc('max(1, 2, 3)')     // 3
calc('sqrt(16)')         // 4
calc('abs(-42)')         // 42
```

### Complex Expressions

```typescript
calc('sin(PI/4) * cos(PI/4)')                    // ~0.5
calc('sqrt(3^2 + 4^2)')                         // 5
calc('(1 + sqrt(5)) / 2')                       // Golden ratio: ~1.618
calc('log(E^3)')                                // 3
calc('pow(2, 8)')                               // 256
```

## Error Handling

The parser provides detailed error messages:

```typescript
// Syntax errors
expressionParser.parse('2 +')
// Error: Expected expression after '+' at line 1, column 4

expressionParser.parse('2 * * 3')
// Error: Expected expression at line 1, column 5

expressionParser.parse('sin()')
// Error: Function 'sin' expects at least 1 argument

// Runtime errors during evaluation
evaluate(parse('x + 1').value) 
// Error: Undefined variable: x

evaluate(parse('unknownFunc(1)').value)
// Error: Undefined function: unknownFunc

evaluate(parse('10 / 0').value)
// Error: Division by zero
```

## Extensions

### Comparison Operators

```typescript
// Add to binary operators
const comparison = leftAssoc(
  expression,
  lexeme(or(
    string('<='), string('>='), string('!='), string('=='),
    char('<'), char('>')
  ))
)

// Update evaluation
case 'binary':
  // ... existing operators ...
  case '<': return left < right ? 1 : 0
  case '>': return left > right ? 1 : 0
  case '<=': return left <= right ? 1 : 0
  case '>=': return left >= right ? 1 : 0
  case '==': return left === right ? 1 : 0
  case '!=': return left !== right ? 1 : 0
```

### Conditional Expressions

```typescript
// Ternary operator: condition ? true_expr : false_expr
const conditional = parser(function* () {
  const condition = yield* comparison
  const ternary = yield* optional(parser(function* () {
    yield* lexeme(char('?'))
    const trueExpr = yield* expression
    yield* lexeme(char(':'))
    const falseExpr = yield* expression
    return { trueExpr, falseExpr }
  }))
  
  if (ternary) {
    return {
      type: 'conditional',
      condition,
      trueExpr: ternary.trueExpr,
      falseExpr: ternary.falseExpr
    }
  }
  
  return condition
})
```

### Constants and Units

```typescript
const constant = or(
  string('PI').map(() => ({ type: 'number', value: Math.PI })),
  string('E').map(() => ({ type: 'number', value: Math.E })),
  string('GOLDEN_RATIO').map(() => ({ type: 'number', value: (1 + Math.sqrt(5)) / 2 }))
)

// Units: 5m, 10kg, 3.14rad
const numberWithUnit = parser(function* () {
  const value = yield* number
  const unit = yield* optional(identifier)
  return { type: 'measurement', value, unit: unit || 'scalar' }
})
```

### Variable Assignment

```typescript
const assignment = parser(function* () {
  const name = yield* lexeme(identifier)
  yield* lexeme(char('='))
  const value = yield* expression
  return { type: 'assignment', name, value }
})

const statement = or(assignment, expression)
```

## REPL Implementation

```typescript
class Calculator {
  private env: Environment = { ...defaultEnv }
  
  evaluate(input: string): number | void {
    try {
      const result = expressionParser.parse(input)
      if (result.isLeft()) {
        throw new Error(result.error.message)
      }
      
      const ast = result.value
      
      // Handle assignments
      if (ast.type === 'assignment') {
        const value = evaluate(ast.value, this.env)
        this.env.variables[ast.name] = value
        console.log(`${ast.name} = ${value}`)
        return
      }
      
      // Evaluate expression
      const value = evaluate(ast, this.env)
      console.log(value)
      return value
      
    } catch (error) {
      console.error('Error:', error.message)
    }
  }
  
  setVariable(name: string, value: number) {
    this.env.variables[name] = value
  }
  
  setFunction(name: string, fn: (...args: number[]) => number) {
    this.env.functions[name] = fn
  }
}

// Usage
const calc = new Calculator()
calc.evaluate('x = 10')        // x = 10
calc.evaluate('y = x * 2')     // y = 20
calc.evaluate('sqrt(x^2 + y^2)')  // 22.36...
```

This expression parser demonstrates operator precedence handling, AST construction, and evaluation. It's a complete implementation that can be extended with additional operators, functions, and language features.
