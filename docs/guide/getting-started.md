# Getting Started

## Installation

```bash
npm add parserator     # or pnpm/yarn/bun add parserator
```

## The two-minute tour

```ts
import { char, digit, many1, parser } from "parserator";

const number = many1(digit).map(ds => Number(ds.join("")));
const parensNumber = parser(function* () {
  yield* char("(");
  const n = yield* number;
  yield* char(")");
  return n;
});

parensNumber.parseOrThrow("(42)"); // → 42
```

> Notice how each mini-parser (`char`, `digit`, `many1`) is a **plain function call**—no new syntax to learn.

## What happened?

1. **`many1(digit)`** - parses 1 or more digits.
2. **`parser(function* () { … })`** - a generator lets you `yield*` each step and return a final value.
3. **`parseOrThrow`** - convenience that throws if input is invalid.

Move on to **Basic Concepts** for a deeper look at these parts.
