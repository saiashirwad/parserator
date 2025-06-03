# Parser Class API

The `Parser<T, Ctx>` class is the core of Parserator. It represents a parser that can consume input and produce a value of type `T` with optional context of type `Ctx`.

## Type Parameters

- `T`: The type of value this parser produces
- `Ctx`: The type of parsing context (defaults to `{}`)

## Constructor

```typescript
new Parser<T, Ctx>(
  run: (state: ParserState<Ctx>) => ParserOutput<T, Ctx>,
  options?: ParserOptions
)
```

- `run`: Function that performs the actual parsing
- `options`: Optional configuration (currently supports `name` for debugging)

## Static Methods

### `Parser.succeed(value, state)`

Creates a successful parse result.

```typescript
static succeed<T, Ctx = {}>(
  value: T,
  state: ParserState<Ctx>
): ParserOutput<T, Ctx>
```

**Example:**

```typescript
return Parser.succeed("hello", newState);
```

### `Parser.fail(error, state)`

Creates a failed parse result with a custom error.

```typescript
static fail<Ctx = {}>(
  error: { message: string; expected?: string[]; found?: string },
  state: ParserState<Ctx>
): ParserOutput<never, Ctx>
```

**Example:**

```typescript
return Parser.fail({ message: "Expected digit", expected: ["0-9"], found: "a" }, state);
```

### `Parser.error(message, expected?, stateCallback?)`

Creates a parser that always fails with the given error.

```typescript
static error<Ctx = {}>(
  message: string,
  expected: string[] = [],
  stateCallback?: (state: ParserState<Ctx>) => ParserState<Ctx>
): Parser<never, Ctx>
```

**Example:**

```typescript
const errorParser = Parser.error("This always fails");
```

### `Parser.pure(value)`

Creates a parser that always succeeds with the given value without consuming input.

```typescript
static pure<A>(a: A): Parser<A>
```

**Example:**

```typescript
const alwaysHello = Parser.pure("hello");
console.log(alwaysHello.parseOrThrow("anything")); // "hello"
```

### `Parser.lazy(fn)`

Creates a parser that lazily evaluates the given function. Essential for recursive parsers.

```typescript
static lazy<T>(fn: () => Parser<T>): Parser<T>
```

**Example:**

```typescript
let expr: Parser<number>;
const parenExpr = Parser.lazy(() => char("(").then(expr).thenDiscard(char(")")));
```

### `Parser.gen(generator)`

Creates a parser using generator syntax for imperative-style composition.

```typescript
static gen<T, Ctx = unknown>(
  f: () => Generator<Parser<any, Ctx>, T, any>
): Parser<T, Ctx>
```

**Example:**

```typescript
const dateParser = Parser.gen(function* () {
  const year = yield* many1(digit).map(d => parseInt(d.join("")));
  yield* char("-");
  const month = yield* many1(digit).map(d => parseInt(d.join("")));
  yield* char("-");
  const day = yield* many1(digit).map(d => parseInt(d.join("")));

  return new Date(year, month - 1, day);
});
```

### `Parser.Do`

Convenience property for starting a do-notation chain.

```typescript
static Do: Parser<{}>
```

**Example:**

```typescript
const parser = Parser.Do.bind("name", stringParser).bind("age", numberParser);
```

## Instance Methods

### Parsing Methods

#### `parse(input, context?)`

Parse the input string and return the result with state information.

```typescript
parse(
  input: string,
  context?: ParserContext<Ctx>
): ParserOutput<T, Ctx>
```

**Example:**

```typescript
const result = parser.parse("hello world");
if (Either.isRight(result.result)) {
  console.log("Success:", result.result.right);
  console.log("Remaining:", result.state.remaining);
} else {
  console.log("Error:", result.result.left);
}
```

#### `parseOrError(input, context?)`

Parse and return either the result or the error bundle.

```typescript
parseOrError(
  input: string,
  context?: ParserContext<Ctx>
): T | ParseErrorBundle
```

**Example:**

```typescript
const result = parser.parseOrError("hello");
if (result instanceof ParseErrorBundle) {
  console.log("Parse failed:", result.primary.message);
} else {
  console.log("Parse succeeded:", result);
}
```

#### `parseOrThrow(input, context?)`

Parse and return the result or throw an error on failure.

```typescript
parseOrThrow(
  input: string,
  context?: ParserContext<Ctx>
): T
```

**Example:**

```typescript
try {
  const result = parser.parseOrThrow("hello");
  console.log("Success:", result);
} catch (error) {
  console.log("Parse failed:", error);
}
```

### Transformation Methods

#### `map(fn)`

Transform the result of this parser using the given function.

```typescript
map<B>(f: (a: T) => B): Parser<B, Ctx>
```

**Example:**

```typescript
const stringNumber = many1(digit).map(digits => digits.join(""));
const actualNumber = stringNumber.map(str => parseInt(str));
```

#### `flatMap(fn)`

Chain this parser with another parser that depends on the result.

```typescript
flatMap<B>(f: (a: T) => Parser<B, Ctx>): Parser<B, Ctx>
```

**Example:**

```typescript
const lengthPrefixedString = many1(digit)
  .map(d => parseInt(d.join("")))
  .flatMap(length => manyNExact(anyChar(), length).map(chars => chars.join("")));
```

### Combination Methods

#### `zip(other)`

Combine this parser with another, returning both results as a tuple.

```typescript
zip<B>(parserB: Parser<B, Ctx>): Parser<[T, B], Ctx>
```

**Example:**

```typescript
const nameAge = stringParser.zip(numberParser);
// Result type: Parser<[string, number], Ctx>
```

#### `then(other)`

Parse this parser, then the other, returning only the second result.

```typescript
then<B>(parserB: Parser<B, Ctx>): Parser<B, Ctx>
```

**Example:**

```typescript
const worldParser = string("Hello").then(char(" ")).then(string("World"));
// Returns: "World"
```

#### `thenDiscard(other)`

Parse this parser, then the other, returning only the first result.

```typescript
thenDiscard<B>(parserB: Parser<B, Ctx>): Parser<T, Ctx>
```

**Example:**

```typescript
const helloParser = string("Hello").thenDiscard(char(" ")).thenDiscard(string("World"));
// Returns: "Hello"
```

#### `bind(key, other)`

Bind the result of another parser to a key in the result object.

```typescript
bind<K extends string, B>(
  k: K,
  other: Parser<B, Ctx> | ((a: T) => Parser<B, Ctx>)
): Parser<T & { [k in K]: B }, Ctx>
```

**Example:**

```typescript
const person = Parser.Do.bind("name", stringParser).bind("age", numberParser);
// Result type: Parser<{ name: string; age: number }>
```

### Utility Methods

#### `trim(parser)`

Parse whitespace, then this parser, then whitespace again.

```typescript
trim(parser: Parser<any, Ctx>): Parser<T, Ctx>
```

**Example:**

```typescript
const trimmedString = stringParser.trim(whitespace);
```

#### `trimLeft(parser)`

Parse the trim parser, then this parser.

```typescript
trimLeft(parser: Parser<any, Ctx>): Parser<T, Ctx>
```

#### `trimRight(parser)`

Parse this parser, then the trim parser.

```typescript
trimRight(parser: Parser<any, Ctx>): Parser<T, Ctx>
```

### Error Handling Methods

#### `withError(makeMessage)`

Add a custom error message to this parser.

```typescript
withError(
  makeMessage: (errorCtx: {
    error: ParseErrorBundle
    state: ParserState<Ctx>
  }) => string
): Parser<T, Ctx>
```

**Example:**

```typescript
const parser = digit.withError(() => "Expected a single digit");
```

#### `label(name)`

Add a label to this parser for better error messages.

```typescript
label(name: string): Parser<T, Ctx>
```

**Example:**

```typescript
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/).label("identifier");
```

#### `expect(description)`

Convenience method that combines `label` and `withError`.

```typescript
expect(description: string): Parser<T, Ctx>
```

**Example:**

```typescript
const number = many1(digit).expect("a number");
```

### Debug Methods

#### `tap(callback)`

Add a side effect that observes the parse state without affecting the result.

```typescript
tap(
  callback: (args: {
    state: ParserState<Ctx>
    result: ParserOutput<T, Ctx>
  }) => void
): Parser<T, Ctx>
```

**Example:**

```typescript
const debugParser = parser.tap(({ state, result }) => {
  console.log("Position:", state.pos);
  console.log("Result:", result);
});
```

#### `withTrace(label)`

Add tracing to this parser (only active when debug mode is enabled).

```typescript
withTrace(label: string): Parser<T, Ctx>
```

**Example:**

```typescript
const tracedParser = parser.withTrace("my-parser");
```

#### `name(name)`

Set the name of this parser for debugging purposes.

```typescript
name(name: string): Parser<T, Ctx>
```

**Example:**

```typescript
const namedParser = parser.name("important-parser");
```

## Properties

#### `options`

The parser options including name and other metadata.

```typescript
options?: ParserOptions
```

#### `run`

The internal parsing function. Generally not used directly.

```typescript
run: (state: ParserState<Ctx>) => ParserOutput<T, Ctx>;
```

## Generator Interface

Parsers implement the generator interface, allowing them to be used with `yield*`:

```typescript
*[Symbol.iterator](): Generator<Parser<T, Ctx>, T, any>
```

**Example:**

```typescript
const parser = Parser.gen(function* () {
  const hello = yield* string("Hello");
  const space = yield* char(" ");
  const world = yield* string("World");
  return `${hello}${space}${world}`;
});
```

## Type Inference

Parserator provides excellent type inference. You rarely need to specify types explicitly:

```typescript
// All types are inferred correctly
const stringParser = string("hello"); // Parser<string>
const numberParser = many1(digit).map(d => parseInt(d.join(""))); // Parser<number>
const tupleParser = stringParser.zip(numberParser); // Parser<[string, number]>

// Complex nested types work too
const objectParser = Parser.gen(function* () {
  const name = yield* stringParser;
  const age = yield* numberParser;
  return { name, age }; // Correctly inferred as { name: string; age: number }
});
```

## Context Usage

When using custom context types:

```typescript
interface MyContext {
  debug: boolean;
  variables: Map<string, any>;
}

const contextParser = Parser.gen<string, MyContext>(function* () {
  // Access context through parser state
  const currentState = yield* peekState;
  if (currentState.context.debug) {
    console.log("Debug mode enabled");
  }

  const result = yield* someOtherParser;
  return result;
});

// Use with context
const result = contextParser.parse("input", { debug: true, variables: new Map(), source: "input" });
```

## Best Practices

1. **Use meaningful names**: Always use `name()` or `label()` for complex parsers
2. **Handle errors gracefully**: Use `withError()` and `expect()` for user-friendly messages
3. **Leverage type inference**: Let TypeScript infer types instead of specifying them explicitly
4. **Use generator syntax**: For complex parsers, generator syntax is more readable
5. **Avoid infinite loops**: Ensure parsers always consume input when they succeed
6. **Reuse parsers**: Create parser instances once and reuse them for better performance

## See Also

- [Combinators API](./combinators.md) - Functions that create and combine parsers
- [Error Handling](./error-handling.md) - Detailed error handling strategies
- [Generator Syntax](../advanced/generator-syntax.md) - Advanced generator usage patterns
- [Examples](../examples/) - Real-world parser examples
