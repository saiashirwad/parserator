# Parser

The `Parser<T>` class is the core of Parserator. It wraps a parsing function and provides a rich set of methods for transformation, sequencing, and error handling.

## Running Parsers

### parse()

```typescript
parse(input: string): ParserOutput<T>
```

Runs the parser and returns the full `ParserOutput`, which contains both the `result` (an `Either` of `ParseErrorBundle` or `T`) and the final `ParserState`.

```typescript
const output = parser.parse("hello");
if (output.result._tag === "Right") {
  console.log(output.result.right); // Parsed value
}
```

### parseOrThrow()

```typescript
parseOrThrow(input: string): T
```

Returns the parsed value directly if successful. Throws a `ParseErrorBundle` if parsing fails.

```typescript
try {
  const value = parser.parseOrThrow("hello");
} catch (e) {
  if (e instanceof ParseErrorBundle) {
    console.error(e.format("ansi"));
  }
}
```

### parseOrError()

```typescript
parseOrError(input: string): T | ParseErrorBundle
```

Returns the parsed value or a `ParseErrorBundle` on failure. This is a non-throwing alternative to `parseOrThrow`.

### parseFast()

```typescript
parseFast(input: string): ParserOutput<T>
```

An optimized version of `parse()` that uses a mutable context internally to reduce allocations. It returns the same `ParserOutput` format.

---

## Transformation

### map()

```typescript
map<U>(fn: (value: T) => U): Parser<U>
```

Transforms the successful result of a parser using the provided function.

```typescript
const number = many1(digit).map(d => parseInt(d.join("")));
```

### flatMap()

```typescript
flatMap<U>(fn: (value: T) => Parser<U>): Parser<U>
```

Chains parsers where the next parser depends on the result of the current one. This is the monadic `bind` operation.

```typescript
const sized = digit.flatMap(d => {
  const n = parseInt(d);
  return manyNExact(char("x"), n);
});
// "3xxx" -> ["x", "x", "x"]
```

---

## Sequencing

### then()

```typescript
then<U>(next: Parser<U>): Parser<U>
```

Runs the current parser followed by the next parser. If both succeed, it returns the result of the **second** parser.

```typescript
string("hello").then(string(" world")); // -> " world"
```

### thenDiscard()

```typescript
thenDiscard<U>(next: Parser<U>): Parser<T>
```

Runs the current parser followed by the next parser. If both succeed, it returns the result of the **first** parser.

```typescript
identifier.thenDiscard(char(";")); // -> identifier value
```

### zip()

```typescript
zip<U>(other: Parser<U>): Parser<[T, U]>
```

Runs both parsers in sequence and returns their results as a tuple.

```typescript
digit.zip(digit); // Parser<[string, string]>
```

---

## Error Handling

### expect()

```typescript
expect(message: string): Parser<T>
```

Provides a custom error message that will be used if the parser fails.

```typescript
char(")").expect("closing parenthesis");
// Error: "Expected closing parenthesis"
```

### label()

```typescript
label(name: string): Parser<T>
```

Adds a name to the context stack for error reporting. This helps identify which part of a complex grammar failed.

```typescript
const id = many1(alphabet).label("identifier");
```

---

## Control Flow

### atomic()

```typescript
atomic(): Parser<T>
```

Creates an "all-or-nothing" version of the parser. If the parser fails, it resets the input position to where it started, as if no input was consumed.

```typescript
const keyword = string("function").atomic();
```

### commit()

```typescript
commit(): Parser<T>
```

Prevents backtracking after this parser succeeds. If a subsequent parser in a sequence fails, Parserator will not backtrack to try other alternatives in an `or()` or `choice()` block.

```typescript
const ifStmt = parser(function* () {
  yield* string("if");
  yield* commit(); // Once "if" is seen, we must parse an if-statement
  // ...
});
```

---

## Utilities

### tap()

```typescript
tap(fn: (args: { state: ParserState, result: ParserOutput<T> }) => void): Parser<T>
```

Allows inspecting the parser state and result during execution without modifying them. Useful for debugging.

### trimLeft()

```typescript
trimLeft(ws: Parser<any>): Parser<T>
```

Skips input matched by `ws` before running the current parser.

### trimRight()

```typescript
trimRight(ws: Parser<any>): Parser<T>
```

Skips input matched by `ws` after running the current parser.

### trim()

```typescript
trim(ws: Parser<any>): Parser<T>
```

Skips input matched by `ws` both before and after running the current parser.

---

## Static Methods

### Parser.pure()

```typescript
static pure<T>(value: T): Parser<T>
```

Creates a parser that always succeeds with the given value without consuming any input. (Also available as `Parser.lift`).

### Parser.fail()

```typescript
static fail(error: { message: string }): Parser<never>
```

Creates a parser that always fails with the specified error message.

### Parser.fatal()

```typescript
static fatal(message: string): Parser<never>
```

Creates a parser that fails with a fatal error, which immediately stops parsing and prevents any backtracking.

### Parser.lazy()

```typescript
static lazy<T>(fn: () => Parser<T>): Parser<T>
```

Defers the creation of a parser until it is actually run. Essential for defining recursive grammars.

```typescript
const expr = Parser.lazy(() => or(atom, compound));
```

### Parser.gen()

```typescript
static gen<T>(genFn: () => Generator<Parser<any>, T>): Parser<T>
```

Creates a parser from a generator function. This is the primary way to build complex, readable parsers in Parserator.

---

## The parser() Function

```typescript
function parser<T>(genFn: () => Generator<Parser<any>, T>): Parser<T>;
```

A convenient alias for `Parser.gen`. It allows using `yield*` to sequence parsers and capture their results as variables.

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
