# Error Handling Improvements

## 1. Add commit/cut functionality

[ ] Add `committed` flag to ParserContext

```ts
interface ParserContext<T = {}> {
  // ... existing fields
  committed?: boolean;
}
```

[ ] Add `commit()` method to Parser class

```ts
commit(): Parser<T, Ctx> {
  return new Parser(state => {
    const result = this.run(state)
    if (Either.isRight(result.result)) {
      return {
        ...result,
        state: {
          ...result.state,
          context: {
            ...result.state.context,
            committed: true
          }
        }
      }
    }
    return result
  })
}
```

[ ] Add standalone `commit()` and `cut()` functions

```ts
export function commit<Ctx = {}>(): Parser<void, Ctx> {
  return new Parser(state => {
    return Parser.succeed(void 0, { ...state, context: { ...state.context, committed: true } });
  });
}

export const cut = commit; // Alias for Prolog-style naming
```

## 2. Add atomic parser functionality

[ ] Add `atomic()` method to Parser class

```ts
atomic(): Parser<T, Ctx> {
  return new Parser(state => {
    const result = this.run(state)
    if (Either.isLeft(result.result)) {
      // Reset to original state on failure
      return {
        result: result.result,
        state // Return original state, not updated state
      }
    }
    return result
  })
}
```

[ ] Add standalone `atomic()` combinator

```ts
export function atomic<T, Ctx = {}>(parser: Parser<T, Ctx>): Parser<T, Ctx> {
  return parser.atomic();
}
```

## 3. Add recovery functionality

[ ] Add `recover()` method to Parser class

```ts
recover(defaultValue: T): Parser<T, Ctx> {
  return new Parser(state => {
    const result = this.run(state)
    if (Either.isLeft(result.result)) {
      // Store error in context for later reporting if needed
      const recoveredState = {
        ...state,
        context: {
          ...state.context,
          recoveredErrors: [
            ...(state.context.recoveredErrors || []),
            result.result.left
          ]
        }
      }
      return Parser.succeed(defaultValue, recoveredState)
    }
    return result
  })
}
```

## 4. Add fatal error functionality

[ ] Add "Fatal" error type to ParseErr union

```ts
export type ParseErr =
  | { tag: "Expected"; span: Span; items: string[]; context: string[] }
  | { tag: "Unexpected"; span: Span; found: string; context: string[]; hints?: string[] }
  | { tag: "Custom"; span: Span; message: string; hints?: string[]; context: string[] }
  | { tag: "Fatal"; span: Span; message: string; context: string[] }; // New
```

[ ] Add `fatal()` static method to Parser class

```ts
static fatal<Ctx = {}>(message: string): Parser<never, Ctx> {
  return new Parser(state => {
    const span = createSpan(state)
    const fatalError: ParseErr = {
      tag: "Fatal",
      span,
      message,
      context: state.context?.labelStack ?? []
    }

    return Parser.failRich({ errors: [fatalError] }, state)
  })
}
```

## 5. Update Parser.gen error handling

[ ] Modify the error handling in `Parser.gen` to respect commit state

```ts
static gen = <T, Ctx = unknown>(
  f: () => Generator<Parser<any, Ctx>, T, any>
): Parser<T, Ctx> =>
  new Parser<T, Ctx>(state => {
    const iterator = f()
    let current = iterator.next()
    let currentState: ParserState<Ctx> = state

    while (!current.done) {
      const { result, state: updatedState } = current.value.run(currentState)

      if (Either.isLeft(result)) {
        const isCommitted = updatedState.context?.committed || state.context?.committed
        const hasFatalError = result.left.errors.some(e => e.tag === "Fatal")

        // If committed or fatal, return immediately
        if (isCommitted || hasFatalError) {
          return {
            result: result as unknown as Either<T, ParseErrorBundle>,
            state: updatedState
          }
        }

        // Otherwise, for now just return (but this is where we could accumulate)
        return {
          result: result as unknown as Either<T, ParseErrorBundle>,
          state: updatedState
        }
      }

      currentState = updatedState
      current = iterator.next(result.right)
    }

    return Parser.succeed(current.value, currentState)
  })
```

## 6. Update error handling in combinators

[ ] Update `or` combinator to accumulate errors when not committed

```ts
// In or combinator implementation
or<B>(other: Parser<B, Ctx>): Parser<T | B, Ctx> {
  return new Parser(state => {
    const firstResult = this.run(state)

    // If first succeeded or we're committed, return immediately
    if (Either.isRight(firstResult.result) || state.context?.committed) {
      return firstResult
    }

    // Try second parser
    const secondResult = other.run(state)

    // If second failed too, merge errors
    if (Either.isLeft(secondResult.result)) {
      const mergedErrors = [
        ...firstResult.result.left.errors,
        ...secondResult.result.left.errors
      ]
      return Parser.failRich({ errors: mergedErrors }, state)
    }

    return secondResult
  })
}
```

## 7. Add examples and tests

[ ] Create examples showing the new error handling patterns

```ts
// Example: JSON parser with commit points
const jsonObject = Parser.gen(function* () {
  yield* char("{");
  yield* commit(); // After seeing '{', we're committed to parsing an object

  const pairs = yield* sepBy(
    keyValue.recover(null), // Recover from individual pair errors
    char(",")
  );

  yield* char("}").expect("closing brace for object");
  return Object.fromEntries(pairs.filter(p => p !== null));
});

// Example: Statement parser with cut
const ifStatement = Parser.gen(function* () {
  yield* keyword("if");
  yield* cut(); // No backtracking after seeing "if"

  yield* char("(").expect("opening parenthesis after 'if'");
  const condition = yield* expression;
  yield* char(")").expect("closing parenthesis after condition");

  const body = yield* block;
  return { type: "if", condition, body };
});
```

[ ] Add unit tests for each new feature

- Test commit() prevents backtracking in choice
- Test atomic() resets state on failure
- Test recover() continues parsing with default
- Test fatal() causes immediate failure even in choice
- Test error accumulation in or() vs immediate failure after commit()
