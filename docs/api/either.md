# Either

The `Either` type is a simple container used by Parserator to represent a value that can be one of two types: a success (`Right`) or a failure (`Left`).

While primarily used internally to handle parsing results, you will encounter it when calling the `.parse()` method on a parser.

## Either Type

The `Either` type is a union of `Left` and `Right` objects.

```typescript
type Either<R, L> = Left<L, R> | Right<R, L>;

interface Left<L, R> {
  readonly _tag: "Left";
  readonly left: L;
}

interface Right<R, L> {
  readonly _tag: "Right";
  readonly right: R;
}
```

- **Right**: Represents success and contains the successfully parsed value.
- **Left**: Represents failure and contains the error details (usually a `ParseErrorBundle`).

## Factory Functions

The `Either` constant provides utility functions for creating and checking `Either` values.

```typescript
const Either = {
  // Create a Left (failure)
  left<L, R>(value: L): Either<R, L>,

  // Create a Right (success)
  right<R, L>(value: R): Either<R, L>,

  // Check if a value is a Left
  isLeft<R, L>(either: Either<R, L>): either is Left<L, R>,

  // Check if a value is a Right
  isRight<R, L>(either: Either<R, L>): either is Right<R, L>
};
```

## Usage with Parsers

When you use the `.parse()` method (instead of `.parseOrThrow()`), the result's `result` property is an `Either`.

```typescript
import { char, Either } from "parserator";

const parser = char("A");
const output = parser.parse("A");

if (Either.isRight(output.result)) {
  // Access the success value
  console.log("Found:", output.result.right); // "A"
} else {
  // Access the error details
  console.log("Error:", output.result.left.format());
}
```

## Pattern Matching

You can use the `match` function to handle both cases in a single expression.

```typescript
const message = Either.match(
  error => `Failed: ${error.format()}`,
  value => `Success: ${value}`
)(output.result);
```

## Generator Support

`Either` implements the iterable protocol, allowing it to be used with `yield*` inside generators. This is used by the library's internal `Either.gen` utility to chain operations that might fail.

```typescript
const combined = Either.gen(function* () {
  const x = yield* Either.right(10);
  const y = yield* Either.right(20);
  return x + y;
});

// result is Right(30)
```
