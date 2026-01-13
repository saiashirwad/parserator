# Expression Parser

This example demonstrates how to build a math expression parser with support for operator precedence and associativity using **Parserator**.

## Overview

We will build a parser that can handle:

- Numbers (integers and decimals)
- Basic arithmetic: `+`, `-`, `*`, `/`
- Exponentiation: `^`
- Parentheses: `(...)`
- Correct operator precedence (BODMAS/PEMDAS)
- Correct associativity (left-associative for most, right-associative for `^`)

## The AST (Abstract Syntax Tree)

First, let's define the types for our expression tree:

```typescript
type Expr =
  | { type: "number"; value: number }
  | { type: "binary"; op: string; left: Expr; right: Expr };
```

## Associativity Helpers

In arithmetic, operator associativity determines how operators of the same precedence are grouped.

### Left Associativity

For operators like `+` or `-`, `1 - 2 - 3` should be parsed as `(1 - 2) - 3`. This is called **left associativity**.

```typescript
import { parser, many, Parser } from "parserator";

function leftAssoc(operand: Parser<Expr>, op: Parser<string>): Parser<Expr> {
  return parser(function* () {
    const first = yield* operand;
    const rest = yield* many(
      parser(function* () {
        const operator = yield* op;
        const right = yield* operand;
        return { operator, right };
      })
    );
    return rest.reduce(
      (left, { operator, right }) => ({
        type: "binary",
        op: operator,
        left,
        right
      }),
      first
    );
  });
}
```

### Right Associativity

For exponentiation `^`, `2 ^ 3 ^ 4` should be parsed as `2 ^ (3 ^ 4)`. This is called **right associativity**. We can implement this recursively.

```typescript
function rightAssoc(operand: Parser<Expr>, op: Parser<string>): Parser<Expr> {
  return parser(function* () {
    const left = yield* operand;
    return yield* or(
      parser(function* () {
        const operator = yield* op;
        const right = yield* rightAssoc(operand, op);
        return { type: "binary", op: operator, left, right } as Expr;
      }),
      Parser.pure(left)
    );
  });
}
```

## Token Parsers

Let's define our basic building blocks: numbers and operators.

```typescript
import { char, regex, or, between, commit } from "parserator";

// Match a number (integer or decimal)
const number = regex(/[0-9]+(\.[0-9]+)?/).map(
  n => ({ type: "number", value: parseFloat(n) }) as Expr
);

// Whitespace-insensitive character parser
const symbol = (s: string) => char(s).trim(regex(/\s*/));
```

## Building the Parser with Precedence

To handle precedence, we define parsers in levels from highest to lowest precedence. Each level calls the level above it.

1.  **Factor**: Atoms (numbers or parenthesized expressions)
2.  **Power**: Exponentiation (`^`, right-associative)
3.  **Term**: Multiplication and Division (`*`, `/`, left-associative)
4.  **Expression**: Addition and Subtraction (`+`, `-`, left-associative)

```typescript
// level 1: atoms
const factor: Parser<Expr> = or(
  number,
  between(
    symbol("("),
    symbol(")"),
    Parser.lazy(() => expression)
  )
);

// level 2: exponentiation (highest precedence)
const power = rightAssoc(factor, symbol("^"));

// level 3: multiplication and division
const term = leftAssoc(power, or(symbol("*"), symbol("/")));

// level 4: addition and subtraction (lowest precedence)
const expression: Parser<Expr> = leftAssoc(term, or(symbol("+"), symbol("-")));
```

## Error Handling with `commit()`

To provide better error messages, we can use `commit()`. Once we see an opening parenthesis, we "commit" to parsing a parenthesized expression.

```typescript
const parenthesized = parser(function* () {
  yield* symbol("(");
  yield* commit(); // No backtracking after '('
  const expr = yield* expression;
  yield* symbol(")").expect("closing parenthesis");
  return expr;
});

// Update factor to use our improved parenthesized parser
const factor: Parser<Expr> = or(number, parenthesized);
```

## Evaluation

Once we have the AST, evaluating it is a simple recursive function:

```typescript
function evaluate(expr: Expr): number {
  if (expr.type === "number") return expr.value;

  const left = evaluate(expr.left);
  const right = evaluate(expr.right);

  switch (expr.op) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return left / right;
    case "^":
      return Math.pow(left, right);
    default:
      throw new Error(`Unknown operator: ${expr.op}`);
  }
}
```

## Usage Examples

```typescript
const mathParser = expression.thenDiscard(eof);

const run = (input: string) => {
  const ast = mathParser.parseOrThrow(input);
  return evaluate(ast);
};

console.log(run("2 + 3 * 4")); // 14  (3 * 4 first)
console.log(run("(2 + 3) * 4")); // 20  (parentheses first)
console.log(run("2 ^ 3 ^ 2")); // 512 (2 ^ 9, right-associative)
console.log(run("10 / 2 / 2")); // 2.5 (5 / 2, left-associative)
console.log(run("2 * (3 + 4) ^ 2")); // 98  (2 * 49)
```
