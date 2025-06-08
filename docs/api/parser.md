# Parser

## Parser

Parser is the core type that represents a parser combinator. A parser is a function that takes an input state and produces either: - A successful parse result with the remaining input state - An error describing why the parse failed Parsers can be composed using various combinators to build complex parsers from simple building blocks.

## Functions

### constructor

```typescript
constructor(
    /**
     * @internal
     */
    public run: (state: ParserState) => ...
```

Creates a new Parser instance.

**Parameters:**

- `/**
     * @internal
     */
    public run` (`(state: ParserState`)

### parse

```typescript
parse(input: string): ParserOutput<T>
```

Runs the parser on the given input string and returns the full parser output. This method provides access to both the parse result and the final parser state, which includes information about the remaining unparsed input and position.

**Parameters:**

- `input` (`string`) - The string to parse

**Returns:** `ParserOutput<T>` - A parser output containing both the result (success or error) and final state

**Examples:**

```typescript
const parser = string("hello");
const output = parser.parse("hello world");
// output.result contains Either.right("hello")
// output.state contains remaining input " world" and position info
```

### parseOrError

```typescript
parseOrError(input: string): T | ParseErrorBundle
```

Runs the parser on the given input and returns either the parsed value or error bundle. This is a convenience method that unwraps the Either result, making it easier to handle the common case where you just need the value or error without the full parser state information.

**Parameters:**

- `input` (`string`) - The string to parse

**Returns:** `T | ParseErrorBundle` - The successfully parsed value of type T, or a ParseErrorBundle on failure

**Examples:**

```typescript
const parser = number();
const result = parser.parseOrError("42");
if (result instanceof ParseErrorBundle) {
  console.error(result.format());
} else {
  console.log(result); // 42
}
```

### parseOrThrow

```typescript
parseOrThrow(input: string): T
```

Runs the parser on the given input and returns the parsed value or throws an error. This method is useful when you're confident the parse will succeed or want to handle parse errors as exceptions. The thrown error is a ParseErrorBundle which contains detailed information about what went wrong.

**Parameters:**

- `input` (`string`) - The string to parse

**Returns:** `T` - The successfully parsed value of type T

**Examples:**

```typescript
const parser = number();
try {
  const value = parser.parseOrThrow("42");
  console.log(value); // 42
} catch (error) {
  if (error instanceof ParseErrorBundle) {
    console.error(error.format());
  }
}
```

### tap

```typescript
tap(
    callback: (args: { state: ParserState; result: ParserOutput<T> }) => ...
```

Adds a tap point to observe the current state and result during parsing. Useful for debugging parser behavior.

**Parameters:**

- `callback` (`(args: { state: ParserState; result: ParserOutput<T> }`) - Function called with current state and result

**Examples:**

```typescript
const parser = parser(function* () {
  const name = yield* identifier();
  yield* char(':');
  const value = yield* number();
  return { name, value };
});
parser.tap(({ state, result }) => {
  console.log(`Parsed ${result} at position ${state.pos}`);
});
```

### label

```typescript
label(name: string): Parser<T>
```

Adds a label to this parser for better error messages

**Parameters:**

- `name` (`string`) - The label name to add to the context stack

**Returns:** `Parser<T>` - A new parser with the label added

### expect

```typescript
expect(description: string): Parser<T>
```

Helper for creating semantic expectations with both label and error message

**Parameters:**

- `description` (`string`) - The description for both the label and error message

**Returns:** `Parser<T>` - A new parser with both labeling and error message

### atomic

```typescript
atomic(): Parser<T>
```

Creates an atomic parser that either fully succeeds or resets to the original state. This is useful for "all-or-nothing" parsing where you want to try a complex parser but not consume any input if it fails. The parser acts as a transaction - if any part fails, the entire parse is rolled back.

**Returns:** `Parser<T>` - A new parser that resets state on failure

**Examples:**

```typescript
// Without atomic - partial consumption on failure
const badParser = parser(function* () {
  yield* string("foo")
  yield* string("bar")  // If this fails, "foo" is already consumed
})

// With atomic - no consumption on failure
const goodParser = parser(function* () {
  yield* string("foo")
  yield* string("bar")  // If this fails, we reset to before "foo"
}).atomic()
```

```typescript
// Useful for trying complex alternatives
const value = or(
  // Try to parse as a complex expression
  expression.atomic(),
  // If that fails completely, try as a simple literal
  literal
)
```

```typescript
// Lookahead parsing without consumption
const startsWithKeyword = or(
  string("function").atomic(),
  string("const").atomic(),
  string("let").atomic()
).map(() => true).or(Parser.succeed(false))


@see {@link atomic} - Standalone function version
```

