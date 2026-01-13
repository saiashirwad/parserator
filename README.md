# Parserator

Type-safe parser combinators for TypeScript.

## Installation

```bash
npm install parserator
```

## Quick Example

```typescript
import { parser, char, many1, digit } from "parserator";

const number = many1(digit).map(d => parseInt(d.join("")));

const point = parser(function* () {
  yield* char("(");
  const x = yield* number;
  yield* char(",");
  const y = yield* number;
  yield* char(")");
  return { x, y };
});

point.parseOrThrow("(10,20)"); // { x: 10, y: 20 }
```

## Why Parser Combinators?

Build parsers by composing small functions. No separate grammar files, no build steps, full TypeScript inference.

- **Composable** - Small parsers combine into complex ones
- **Type-safe** - Full inference throughout the chain
- **Readable** - Generator syntax mirrors grammar structure
- **Zero dependencies**

## Features

- Generator-based monadic syntax
- Rich error messages with source snippets and position tracking
- Commit/backtracking control for better error reporting
- Performance-optimized fast paths
- Typo suggestions via Levenshtein distance

## Documentation

Full docs at [saiashirwad.github.io/parserator](https://saiashirwad.github.io/parserator/)

## Examples

Complete parsers in `examples/`:

- **JSON** - Full JSON parser
- **INI** - Config file parser
- **Scheme** - Lisp dialect parser
- **ToyML** - ML-like language with let, match, functions, types

## API

### Core Combinators

| Combinator         | Description        |
| ------------------ | ------------------ |
| `char(c)`          | Single character   |
| `string(s)`        | Exact string       |
| `regex(re)`        | Regular expression |
| `many(p)`          | Zero or more       |
| `many1(p)`         | One or more        |
| `or(...ps)`        | Try alternatives   |
| `optional(p)`      | Zero or one        |
| `sepBy(p, sep)`    | Separated list     |
| `between(o, c, p)` | Delimited content  |

### Parser Methods

| Method                 | Description                                  |
| ---------------------- | -------------------------------------------- |
| `.parse(input)`        | Returns `ParserOutput` with result and state |
| `.parseOrThrow(input)` | Returns value or throws `ParseErrorBundle`   |
| `.map(f)`              | Transform result                             |
| `.flatMap(f)`          | Chain parsers                                |
| `.expect(msg)`         | Add error message on failure                 |
| `.commit()`            | Prevent backtracking past this point         |
| `.atomic()`            | All-or-nothing parsing                       |

### Error Handling

```typescript
const ifExpr = parser(function* () {
  yield* keyword("if");
  yield* commit(); // After seeing "if", commit to this path
  const cond = yield* expr.expect("condition after 'if'");
  yield* keyword("then").expect("'then' after condition");
  const body = yield* expr.expect("expression after 'then'");
  return { cond, body };
});
```

With `commit()`, errors say "Expected 'then' after condition" instead of "Expected 'if' or 'let' or ...".

## Performance

For hot paths, use optimized combinators:

```typescript
import { manyChar, manyDigit } from "parserator";

const digits = manyDigit(); // Faster than many(digit)
```

## License

MIT
