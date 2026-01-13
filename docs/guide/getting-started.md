# Getting Started

Welcome to Parserator! This guide will walk you through building your first parsers using TypeScript parser combinators.

## 1. Installation

First, add Parserator to your project:

```bash
npm install parserator
# or
bun add parserator
```

## 2. Your First Parser

Parserator works by combining small, reusable parsing functions. Let's start with the simplest possible building blocks.

### Step 1: Parse a single digit

The `digit` parser matches a single character from `0-9`.

```typescript
import { digit } from "parserator";

const result = digit.parse("5");
// result.result is Either.right("5")
```

### Step 2: Parse multiple digits

To match more than one digit, we use the `many1` combinator, which matches one or more occurrences.

```typescript
import { many1, digit } from "parserator";

const digits = many1(digit);
const result = digits.parseOrThrow("123");
// result is ["1", "2", "3"]
```

### Step 3: Transform the result

Use `.map()` to transform the raw strings into a more useful data type, like a number.

```typescript
const number = many1(digit).map(d => parseInt(d.join("")));

const result = number.parseOrThrow("123");
// result is 123 (as a number)
```

## 3. Generator Syntax

As your parsers grow more complex, chaining methods can become hard to read. Parserator provides a **generator syntax** that lets you write parsers that look like imperative code.

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

const result = point.parseOrThrow("(10,20)");
// result is { x: 10, y: 20 }
```

### How it works:

- `parser(function* () { ... })` creates a new parser from a generator function.
- `yield*` runs a parser and returns its success value. If the inner parser fails, the entire generator parser fails immediately.
- The `return` value of the generator becomes the output of the parser.

## 4. Handling Errors

When parsing fails, Parserator provides detailed information about what went wrong and where.

```typescript
const result = point.parse("(10,)");
// result.result is Either.left(ParseErrorBundle)

// For quick scripts or when you expect success, use parseOrThrow
try {
  point.parseOrThrow("(10,)");
} catch (error) {
  // error is a ParseErrorBundle
  console.error(error.format("ansi"));
  /*
  Error at line 1, column 5:
    (10,)
        ^
  Expected digit
  */
}
```

## 5. What's Next?

Now that you've built your first parser, dive deeper into the core concepts:

- **[Basic Concepts](./basic-concepts.md)** - Understand `Parser<T>`, `Either`, and `ParserState`.
- **[Generator Syntax](./advanced-patterns.md)** - Learn how to handle backtracking and error messages in generators.
- **[Combinators](../api/combinators.md)** - Explore all the available building blocks like `or`, `sepBy`, and `optional`.
