# Generator Syntax

Generator syntax is the most powerful way to compose parsers in Parserator. It allows you to write sequential parsing logic using standard JavaScript control flow while the library handles the underlying parser state and error propagation.

## Why Generators?

In functional parsing, you often need to sequence multiple parsers and use the results of earlier parsers to determine what to do next. While you can do this with method chaining (`.then()`, `.flatMap()`), it quickly becomes hard to read as complexity grows.

Generators let you write code that looks and behaves like synchronous, imperative code. You can use variables, `if/else` statements, and `while` loops, all while maintaining full type safety and monadic error handling.

## Basic Pattern

To create a parser using generator syntax, use the `parser()` function (which is an alias for `Parser.gen`) and pass it a generator function.

```typescript
import { parser, char, many1, digit } from "parserator";

// A parser for a coordinate pair like "(10,20)"
const point = parser(function* () {
  yield* char("(");

  // yield* runs the parser and unwraps its result
  const x = yield* many1(digit).map(d => parseInt(d.join("")));

  yield* char(",");

  const y = yield* many1(digit).map(d => parseInt(d.join("")));

  yield* char(")");

  // The return value becomes the final output of the parser
  return { x, y };
});
```

### Key Concepts:

- `parser(function*() {})`: Wraps a generator into a `Parser<T>`.
- `yield* parser`: Runs a parser. If it fails, the whole generator parser fails. If it succeeds, it "unwraps" the result into a variable.
- `return value`: Sets the final result of the parser. TypeScript infers the parser's return type from this.

## Compared to Method Chaining

Method chaining is great for simple transformations, but generator syntax is often much clearer for multi-step processes.

### Method Chaining

```typescript
const point = char("(")
  .then(number)
  .thenDiscard(char(","))
  .zip(number)
  .thenDiscard(char(")"))
  .map(([x, y]) => ({ x, y }));
```

### Generator Syntax

```typescript
const point = parser(function* () {
  yield* char("(");
  const x = yield* number;
  yield* char(",");
  const y = yield* number;
  yield* char(")");
  return { x, y };
});
```

The generator version mirrors the structure of the grammar you are trying to match, making it easier to maintain and debug.

## Conditional Parsing

Since you are in a standard JavaScript function, you can use `if/else` logic to decide which parser to run based on previous results.

```typescript
const value = parser(function* () {
  const first = yield* anyChar;

  if (first === '"') {
    return yield* stringLiteral;
  } else if (first >= "0" && first <= "9") {
    return yield* numberLiteral;
  } else {
    // Fallback to another parser
    return yield* identifier;
  }
});
```

## Loops in Generators

You can use `while` or `for` loops within a generator to perform repetitive parsing tasks that might be difficult to express with just `many()` or `sepBy()`.

```typescript
const items = parser(function* () {
  const result: string[] = [];

  while (true) {
    // optional() returns undefined instead of failing
    const item = yield* optional(identifier);
    if (!item) break;
    result.push(item);

    const sep = yield* optional(char(","));
    if (!sep) break;
  }

  return result;
});
```

## Error Handling with commit()

The `commit()` combinator is crucial for creating good error messages. By default, if a parser inside an `or()` fails, Parserator might backtrack and try other alternatives. Once you are sure which branch of a grammar you are in, use `commit()`.

```typescript
const ifStatement = parser(function* () {
  yield* string("if");

  // After this point, we KNOW this is an if-statement.
  // We don't want to backtrack if the rest fails.
  yield* commit();

  yield* char("(").expect("opening parenthesis after 'if'");
  const condition = yield* expression;
  yield* char(")").expect("closing parenthesis");

  const body = yield* block;
  return { type: "if", condition, body };
});
```

- **Before `commit()`**: If the parser fails, it can backtrack (allowing `or()` to try the next candidate).
- **After `commit()`**: The parser is "locked in". Any subsequent failure will be reported as a final error at that position.
- **`expect(msg)`**: Adds a human-readable description to the error message if that specific step fails.

## Lazy Evaluation for Recursion

When parsers reference themselves (directly or indirectly), you can use `Parser.lazy()` to handle the circular reference.

```typescript
import { Parser, parser, optional } from "parserator";

// Forward declaration for recursive parsers
let expression: Parser<Expr>;

const atom = parser(function* () {
  // ... parse numbers or parenthesized expressions
});

const term = parser(function* () {
  const left = yield* atom;

  // Use Parser.lazy() for recursive references
  const right = yield* optional(Parser.lazy(() => expression));

  return right ? combine(left, right) : left;
});

expression = term;
```

## Best Practices

- **Use generators for complexity**: Use generators for any parser with 3 or more sequential steps.
- **Method chaining for simplicity**: For simple 1-2 step parsers or simple maps, method chaining is often more concise.
- **Commit early**: Use `commit()` as soon as you have uniquely identified the construct you are parsing.
- **Be descriptive**: Use `.expect()` on required tokens (like delimiters) to provide helpful error messages.
- **Keep it focused**: One generator parser should generally correspond to one rule in your formal grammar.
