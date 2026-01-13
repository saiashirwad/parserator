# Advanced Patterns

Advanced patterns for complex parsing scenarios. This guide covers recursive grammars, operator precedence, context-sensitive parsing, and more.

## Recursive Grammars

For grammars that refer to themselves (like nested parentheses or expressions), use the forward declaration pattern with `Parser.lazy()`. This avoids issues with circular references during initialization.

```typescript
import {
  Parser,
  or,
  between,
  char,
  many1,
  digit,
  identifier
} from "parserator";

// 1. Forward declare the variable
let expression: Parser<any>;

const number = many1(digit).map(d => ({
  type: "number",
  value: parseInt(d.join(""))
}));
const ident = identifier.map(name => ({ type: "identifier", name }));

// 2. Use Parser.lazy() for recursive references
const parenthesized = between(
  char("("),
  char(")"),
  Parser.lazy(() => expression)
);

const atom = or(number, ident, parenthesized);

// 3. Now define the actual expression
expression = atom;
```

## Operator Precedence

Handling operator precedence and associativity is a common requirement for expression parsers.

### Left-Associative Operators

Standard math operations like `1 + 2 + 3` are usually left-associative, meaning they are grouped as `(1 + 2) + 3`.

```typescript
import { parser, many, char, or, Parser } from "parserator";

function leftAssoc<T, Op>(
  operand: Parser<T>,
  operator: Parser<Op>,
  combine: (left: T, op: Op, right: T) => T
): Parser<T> {
  return parser(function* () {
    const first = yield* operand;
    const rest = yield* many(
      parser(function* () {
        const op = yield* operator;
        const right = yield* operand;
        return { op, right };
      })
    );
    return rest.reduce(
      (left, { op, right }) => combine(left, op, right),
      first
    );
  });
}

// Usage: Grouping * and / before + and -
const factor = or(number, parenthesized);
const term = leftAssoc(factor, or(char("*"), char("/")), (left, op, right) => ({
  type: "binary",
  op,
  left,
  right
}));
const expression = leftAssoc(
  term,
  or(char("+"), char("-")),
  (left, op, right) => ({
    type: "binary",
    op,
    left,
    right
  })
);
```

### Right-Associative Operators

Exponentiation (like `2^3^4`) is right-associative, meaning it's grouped as `2^(3^4)`.

```typescript
function rightAssoc<T, Op>(
  operand: Parser<T>,
  operator: Parser<Op>,
  combine: (left: T, op: Op, right: T) => T
): Parser<T> {
  const rec: Parser<T> = parser(function* () {
    const left = yield* operand;
    const opAndRight = yield* optional(
      parser(function* () {
        const op = yield* operator;
        const right = yield* rec; // Recursive call
        return { op, right };
      })
    );
    if (opAndRight) {
      return combine(left, opAndRight.op, opAndRight.right);
    }
    return left;
  });
  return rec;
}
```

## Context-Sensitive Parsing

Sometimes the grammar depends on previously parsed information, such as indentation levels in Python or YAML. You can track state during parsing using a class-based approach.

```typescript
class IndentParser {
  private indent = 0;

  block(): Parser<any> {
    return parser(
      function* () {
        const currentIndent = yield* this.parseIndent();
        if (currentIndent <= this.indent) {
          return yield* Parser.fail("Expected increased indentation");
        }

        const prevIndent = this.indent;
        this.indent = currentIndent;

        const statements = yield* many(this.statement());

        this.indent = prevIndent;
        return { type: "block", statements };
      }.bind(this)
    );
  }

  private parseIndent() {
    /* ... implementation ... */
  }
  private statement() {
    /* ... implementation ... */
  }
}
```

## Whitespace Handling

Instead of manually skipping whitespace everywhere, use a "token" helper pattern to automatically consume trailing whitespace after every terminal symbol.

```typescript
import {
  skipWhitespace,
  many1,
  digit,
  alphabet,
  string,
  char,
  Parser
} from "parserator";

const ws = skipWhitespace();

function token<T>(p: Parser<T>): Parser<T> {
  return p.thenDiscard(ws);
}

// Usage
const number = token(many1(digit).map(d => parseInt(d.join(""))));
const identifier = token(many1(alphabet).map(a => a.join("")));
const keyword = (kw: string) => token(string(kw));
const op = (s: string) => token(char(s));
```

## DSL Patterns

Parserator is ideal for building Domain Specific Languages (DSLs) or configuration formats.

```typescript
const configEntry = parser(function* () {
  const key = yield* identifier;
  yield* token(char("="));
  yield* commit(); // Once we see '=', we must finish this entry
  const value = yield* or(stringLiteral, number, boolean);
  return { key, value };
});

const config = parser(function* () {
  yield* ws;
  const entries = yield* many(configEntry);
  yield* eof;
  return Object.fromEntries(entries.map(e => [e.key, e.value]));
});
```

## Error Recovery

Robust parsers should be able to recover from errors and continue parsing the rest of the file. This is often done by skipping to a "synchronization point" like a semicolon.

```typescript
import { takeUntil, or, char, many } from "parserator";

const statement = or(
  validStatement,
  // Recovery: skip to semicolon
  parser(function* () {
    const skipped = yield* takeUntil(char(";"));
    yield* char(";");
    return { type: "error", skipped };
  })
);

const program = many(statement).map(stmts =>
  stmts.filter(s => s.type !== "error")
);
```

## Testing Parsers

Use standard testing frameworks like `bun:test` to verify your parsers. Check both success and error cases.

```typescript
import { describe, it, expect } from "bun:test";
import { Either } from "parserator";

describe("expression parser", () => {
  it("parses addition", () => {
    const result = expression.parse("1+2");
    expect(Either.isRight(result.result)).toBe(true);
    expect(result.result.right).toEqual({
      type: "binary",
      op: "+",
      left: { type: "number", value: 1 },
      right: { type: "number", value: 2 }
    });
  });

  it("reports errors clearly", () => {
    const result = expression.parse("1+");
    expect(Either.isLeft(result.result)).toBe(true);
    // Verify the error occurred at the expected position
    expect(result.result.left.primary.span.offset).toBe(2);
  });
});
```
