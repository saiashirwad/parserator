# Scheme Parser

This example demonstrates how to build a parser for a recursive language like Scheme (Lisp). We'll cover atomic values, nested lists, and special forms like `lambda` and `let`.

## AST Definition

First, let's define the Abstract Syntax Tree (AST) for our Scheme expressions.

```typescript
export type LispExpr =
  | { type: "Symbol"; name: string }
  | { type: "Number"; value: number }
  | { type: "String"; value: string }
  | { type: "Boolean"; value: boolean }
  | { type: "List"; items: LispExpr[] }
  | { type: "Lambda"; params: string[]; body: LispExpr }
  | {
      type: "Let";
      bindings: { name: string; value: LispExpr }[];
      body: LispExpr;
    }
  | {
      type: "If";
      condition: LispExpr;
      consequent: LispExpr;
      alternate: LispExpr;
    };
```

## Lexical Elements

Before parsing expressions, we need to handle whitespace and comments.

```typescript
import {
  regex,
  skipMany0,
  or,
  char,
  many1,
  digit,
  optional,
  takeUpto,
  commit,
  string,
  Parser,
  parser,
  many
} from "parserator";

const whitespace = regex(/\s+/).label("whitespace");
const lineComment = regex(/;[^\n]*/).label("line comment");
const space = or(whitespace, lineComment);
const spaces = skipMany0(space);

// Helper to consume leading whitespace
function lexeme<T>(p: Parser<T>): Parser<T> {
  return p.trimLeft(spaces);
}
```

## Atomic Parsers

Atoms are the simplest elements: symbols, numbers, strings, and booleans.

```typescript
const symbol = lexeme(
  regex(/[^()\s;]+/).map(name => ({ type: "Symbol", name }) as const)
);

const number = lexeme(
  parser(function* () {
    const sign = (yield* optional(char("-"))) ?? "";
    const digits = yield* many1(digit).expect("digits");
    const decimal = yield* optional(
      parser(function* () {
        yield* char(".");
        const frac = yield* many1(digit).expect("fractional digits");
        return "." + frac.join("");
      })
    );
    return {
      type: "Number",
      value: parseFloat(sign + digits.join("") + (decimal ?? ""))
    } as const;
  })
);

const stringLiteral = lexeme(
  parser(function* () {
    yield* char('"');
    yield* commit(); // Once we see a quote, it MUST be a string
    const value = yield* takeUpto(char('"'));
    yield* char('"').expect("closing quote");
    return { type: "String", value } as const;
  })
);

const boolean = lexeme(
  or(
    string("#t").map(() => ({ type: "Boolean", value: true }) as const),
    string("#f").map(() => ({ type: "Boolean", value: false }) as const)
  )
);

const atom = or(boolean, number, stringLiteral, symbol);
```

## Recursion with `Parser.lazy()`

Because Scheme lists can contain other Scheme lists, we need a recursive parser. In Parserator, we use `Parser.lazy()` to handle forward references.

```typescript
// Forward declaration
let expr: Parser<LispExpr>;

const list = parser(function* () {
  yield* lexeme(char("("));
  yield* commit();

  // Use Parser.lazy to refer to 'expr' which is defined later
  const items = yield* many(Parser.lazy(() => expr));

  yield* lexeme(char(")")).expect("closing parenthesis");
  return items;
});
```

## Special Form Detection

We can use `flatMap` to transform a generic list into a specific AST node if it starts with a keyword like `lambda`, `if`, or `let`.

```typescript
const listOrSpecialForm = list.flatMap(items =>
  parser(function* () {
    if (items.length > 0 && items[0].type === "Symbol") {
      const head = items[0].name;

      // Example: (if condition consequent alternate)
      if (head === "if") {
        if (items.length !== 4)
          return yield* Parser.fatal("if requires 3 arguments");
        return {
          type: "If",
          condition: items[1],
          consequent: items[2],
          alternate: items[3]
        } as const;
      }

      // Example: (lambda (params...) body)
      if (head === "lambda") {
        if (items.length !== 3 || items[1].type !== "List") {
          return yield* Parser.fatal("invalid lambda syntax");
        }
        const params = items[1].items.map(p => {
          if (p.type !== "Symbol") throw new Error("params must be symbols");
          return p.name;
        });
        return { type: "Lambda", params, body: items[2] } as const;
      }
    }
    return { type: "List", items } as const;
  })
);
```

## The Complete Parser

Combining everything into a single entry point:

```typescript
expr = parser(function* () {
  yield* spaces;

  // Decide whether to parse a list or an atom
  const isList = (yield* Parser.peek()) === "(";
  const result = isList ? yield* listOrSpecialForm : yield* atom;

  yield* spaces;
  return result;
});

export const schemeParser = expr;
```

## Usage Example

```typescript
const code = `
  (let ((x 10))
    (if (> x 0)
        "positive"
        "negative"))
`;

try {
  const ast = schemeParser.parseOrThrow(code);
  console.log(JSON.stringify(ast, null, 2));
} catch (err) {
  console.error(err.message);
}
```

### Expected AST Output

```json
{
  "type": "Let",
  "bindings": [{ "name": "x", "value": { "type": "Number", "value": 10 } }],
  "body": {
    "type": "If",
    "condition": {
      "type": "List",
      "items": [
        { "type": "Symbol", "name": ">" },
        { "type": "Symbol", "name": "x" },
        { "type": "Number", "value": 0 }
      ]
    },
    "consequent": { "type": "String", "value": "positive" },
    "alternate": { "type": "String", "value": "negative" }
  }
}
```
