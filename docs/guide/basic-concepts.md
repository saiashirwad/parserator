# Basic Concepts

This guide covers the fundamental types and concepts you'll need to understand to build effective parsers with Parserator.

## 1. What is a Parser?

A parser is a function that:

- Takes a string input.
- Tries to extract structured data from it.
- Returns success with a value, or failure with detailed errors.

In Parserator, every parser is an instance of the `Parser<T>` class.

```typescript
import { string } from "parserator";

const hello = string("hello");
// hello has type Parser<string>

const result = hello.parse("hello world");
// result.result is Either.right("hello")
// result.state.remaining is " world"
```

## 2. The Parser\<T> Type

`Parser<T>` is the core type. The generic parameter `T` represents the type of data the parser produces on success.

```typescript
import { digit, number, point } from "./my-parsers";

const digitParser: Parser<string> = digit; // produces "0"-"9"
const numberParser: Parser<number> = number; // produces numbers
const pointParser: Parser<{ x: number; y: number }> = point; // produces objects
```

## 3. ParserOutput and Either

When you call `parser.parse(input)`, you receive a `ParserOutput<T>` object:

```typescript
type ParserOutput<T> = {
  result: Either<ParseErrorBundle, T>; // Success or failure
  state: ParserState; // Where we are in the input
};
```

The `result` field uses the `Either` type, which has two variants:

- `Either.right(value)` - Represents success.
- `Either.left(errors)` - Represents failure.

```typescript
import { Either, digit } from "parserator";

const result = digit.parse("5");

if (Either.isRight(result.result)) {
  // Access the successful value
  console.log("Parsed:", result.result.right); // "5"
} else {
  // Access the error bundle
  console.log("Error:", result.result.left);
}
```

## 4. ParserState

The `ParserState` tracks the parser's progress through the input string:

```typescript
type ParserState = {
  source: string; // Original input
  remaining: string; // What's left to parse
  pos: {
    offset: number; // Character offset from start (0-indexed)
    line: number; // 1-indexed line number
    column: number; // 1-indexed column number
  };
};
```

After successfully parsing `"hello"` from the input `"hello world"`:

- `remaining` will be `" world"`.
- `offset` will be `5`.
- `line` will be `1`, and `column` will be `6`.

## 5. Three Ways to Run a Parser

Parserator provides different methods depending on how you want to handle the results:

```typescript
// 1. parse() - Full control
// Returns ParserOutput<T> with result and state.
const output = parser.parse(input);

// 2. parseOrThrow() - For quick scripts and tests
// Returns T directly, throws ParseErrorBundle on failure.
const value = parser.parseOrThrow(input);

// 3. parseOrError() - The middle ground
// Returns T | ParseErrorBundle (no throwing).
const valueOrError = parser.parseOrError(input);
```

## 6. ParseErrorBundle

When parsing fails, you receive a `ParseErrorBundle`. This isn't just a simple string; it's a collection of errors encountered during the parsing process.

It contains:

- All errors encountered at the furthest position reached.
- The **primary error** (the error at the furthest offset).
- The original source code for context.

```typescript
try {
  parser.parseOrThrow("invalid input");
} catch (bundle) {
  // Format the error for the terminal with ANSI colors
  console.error(bundle.format("ansi"));

  // Or access the underlying errors
  console.log(bundle.errors);
  console.log(bundle.primary); // The most relevant error
}
```

## 7. Composing Parsers

The real power of Parserator comes from combining simple parsers into complex ones using built-in methods:

```typescript
import { many1, digit, string, or } from "parserator";

// .map() - Transform the result
const number = many1(digit).map(d => parseInt(d.join("")));

// .then() - Sequence two parsers, keep the second result
const greeting = string("hello").then(string(" world"));

// .zip() - Sequence two parsers, keep both results as a tuple
const pair = digit.zip(digit); // Parser<[string, string]>

// or() - Try alternatives in order
const bool = or(string("true"), string("false"));
```

## 8. Next Steps

Now that you understand the basics, you're ready to dive deeper:

- [Generator Syntax](/guide/generator-syntax) - Use the `parser(function*() {})` pattern for complex logic.
- [Combinators](/guide/parser-combinators) - Explore all the built-in building blocks.
- [Error Handling](/guide/error-handling) - Learn how to provide better error messages using `.expect()`.
