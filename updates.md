# Advanced Error Handling Implementation Guide for Parserator

Based on the error handling report, here's a detailed implementation guide for the most impactful improvements to parserator's error system.

## 1. Rich Error Value System

### Current State

```ts
class ParserError {
  constructor(
    public message: string,
    public expected: string[],
    public found?: string
  ) {}
}
```

### Target Implementation

```ts
export type Span = {
  offset: number;
  length: number;
  line: number;
  column: number;
};

export type ParseErr =
  | { tag: "Expected"; span: Span; items: string[]; context: string[] }
  | { tag: "Unexpected"; span: Span; found: string; context: string[] }
  | {
      tag: "Custom";
      span: Span;
      message: string;
      hints?: string[];
      context: string[];
    };

export class ParseErrorBundle {
  constructor(
    public errors: ParseErr[],
    public source: string
  ) {}

  // Get the primary error (furthest right)
  get primary(): ParseErr {
    return this.errors.reduce((furthest, current) =>
      current.span.offset > furthest.span.offset ? current : furthest
    );
  }

  // Get all errors at the same furthest offset
  get primaryErrors(): ParseErr[] {
    const maxOffset = this.primary.span.offset;
    return this.errors.filter((err) => err.span.offset === maxOffset);
  }
}
```

**Benefits:**

- Precise error location with spans
- Multiple error types for different scenarios
- Context stack for nested parsing structures
- Support for hints and suggestions

## 2. Label System & Context Tracking

### Implementation

```ts
export class Parser<T, Ctx = {}> {
  // Add to existing Parser class
  label(name: string): Parser<T, Ctx> {
    return new Parser((state) => {
      const newState = {
        ...state,
        context: {
          ...state.context,
          labelStack: [...(state.context.labelStack || []), name],
        },
      };

      const result = this.run(newState);

      if (Either.isLeft(result.result)) {
        // Convert generic errors to labeled expectations
        const error = result.result.left;
        const labeledError: ParseErr = {
          tag: "Expected",
          span: createSpan(state),
          items: [name],
          context: newState.context.labelStack || [],
        };

        return Parser.fail({ errors: [labeledError] }, result.state);
      }

      return result;
    });
  }

  // Helper for creating semantic expectations
  expect(description: string): Parser<T, Ctx> {
    return this.withError(() => `Expected ${description}`).label(description);
  }
}

// Usage examples
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/).label("identifier");
const number = regex(/\d+/).label("number").expect("a numeric value");
const functionCall = sequence([
  identifier.label("function name"),
  char("(").label("opening parenthesis"),
  sepBy(char(","), expression).label("arguments"),
  char(")").label("closing parenthesis"),
]).label("function call");
```

**End Result:**

```
Error at line 3, column 5:
  Expected function call
    Expected closing parenthesis
    Found: ';'

  Context: expression > function call > closing parenthesis
```

## 3. Automatic Hint Generation

### Implementation

```ts
function generateHints(found: string, expected: string[]): string[] {
  const maxDistance = 2;
  const hints: Array<{ word: string; distance: number }> = [];

  for (const candidate of expected) {
    const distance = levenshteinDistance(found, candidate);
    if (distance <= maxDistance && distance > 0) {
      hints.push({ word: candidate, distance });
    }
  }

  return hints
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map((h) => h.word);
}

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

// Enhanced string combinator with hints
export const keywordWithHints = (keywords: string[]) => (keyword: string) =>
  new Parser((state) => {
    if (state.remaining.startsWith(keyword)) {
      return Parser.succeed(keyword, State.consume(state, keyword.length));
    }

    // Try to extract what the user actually typed
    const match = state.remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    const found = match ? match[0] : state.remaining[0] || "end of input";

    const hints = generateHints(found, keywords);

    const error: ParseErr = {
      tag: "Unexpected",
      span: createSpan(state, found.length),
      found,
      context: state.context.labelStack || [],
      ...(hints.length > 0 && { hints }),
    };

    return Parser.fail({ errors: [error] }, state);
  });

// Usage for Scheme keywords
const schemeKeywords = ["lambda", "let", "if", "cond", "define", "quote"];
const lambda =
  keywordWithHints(schemeKeywords)("lambda").label("lambda keyword");
```

**End Result:**

```
Error at line 2, column 8:
  Unexpected symbol "lamdba"
  Expected: lambda keyword

  Did you mean: lambda?
```

## 4. Advanced Error Recovery Combinators

### Implementation

```ts
// Attempt combinator - backtrack on failure without consuming input
export function attempt<T, Ctx = {}>(parser: Parser<T, Ctx>): Parser<T, Ctx> {
  return new Parser((state) => {
    const result = parser.run(state);
    if (Either.isLeft(result.result)) {
      // Return failure but with original state (no consumption)
      return Parser.fail(result.result.left, state);
    }
    return result;
  });
}

// Recovery combinator
export function recover<T, R, Ctx = {}>(
  parser: Parser<T, Ctx>,
  recovery: Parser<R, Ctx>,
  errorNode: (error: ParseErr, recovered: R) => T
): Parser<T, Ctx> {
  return new Parser((state) => {
    const result = parser.run(state);
    if (Either.isLeft(result.result)) {
      // Try recovery
      const recoveryResult = recovery.run(result.state);
      if (Either.isRight(recoveryResult.result)) {
        const recovered = errorNode(
          result.result.left,
          recoveryResult.result.right
        );
        return Parser.succeed(recovered, recoveryResult.state);
      }
      // Recovery also failed
      return result;
    }
    return result;
  });
}

// Skip until synchronization point
export function skipUntilSync<T, Ctx = {}>(
  syncParser: Parser<T, Ctx>
): Parser<undefined, Ctx> {
  return new Parser((state) => {
    let currentState = state;

    while (!State.isAtEnd(currentState)) {
      const syncResult = syncParser.run(currentState);
      if (Either.isRight(syncResult.result)) {
        return Parser.succeed(undefined, currentState);
      }
      currentState = State.consume(currentState, 1);
    }

    return Parser.succeed(undefined, currentState);
  });
}

// Usage example for Scheme
type SchemeExpr = LispExpr.LispExpr | ErrorExpr;
type ErrorExpr = { type: "Error"; message: string; recovered?: SchemeExpr };

const expressionWithRecovery = recover(
  expr,
  skipUntilSync(or(char(")"), char("\n"), Parser.pure(undefined))),
  (error, _) => ({
    type: "Error" as const,
    message: error.message,
  })
).label("expression");
```

**End Result:**

```ts
// Input: "(lambda (x) (+ x y) (bad-syntax here) (define z 42))"
// Result: Successfully parses with error nodes for bad parts
[
  { type: "Lambda", params: ["x"], body: { type: "List", ... } },
  { type: "Error", message: "Unexpected token 'bad-syntax'" },
  { type: "Define", name: "z", value: { type: "Number", value: 42 } }
]
```

## 5. Context-Aware Error Formatting

### Implementation

```ts
export type ErrorFormat = "plain" | "ansi" | "html" | "json";

export class ErrorFormatter {
  constructor(
    private format: ErrorFormat = "plain",
    private options: {
      maxContextLines?: number;
      showHints?: boolean;
      colorize?: boolean;
    } = {}
  ) {}

  format(bundle: ParseErrorBundle): string {
    switch (this.format) {
      case "ansi":
        return this.formatAnsi(bundle);
      case "html":
        return this.formatHtml(bundle);
      case "json":
        return this.formatJson(bundle);
      default:
        return this.formatPlain(bundle);
    }
  }

  private formatAnsi(bundle: ParseErrorBundle): string {
    const primary = bundle.primary;
    const lines = bundle.source.split("\n");
    const errorLine = lines[primary.span.line - 1];

    return [
      `\x1b[31mError\x1b[0m at line ${primary.span.line}, column ${primary.span.column}:`,
      `  ${errorLine}`,
      `  ${" ".repeat(primary.span.column - 1)}\x1b[31m^\x1b[0m`,
      this.formatErrorMessage(primary),
      ...(primary.hints
        ? primary.hints.map((h) => `  \x1b[36mDid you mean: ${h}?\x1b[0m`)
        : []),
    ].join("\n");
  }

  private formatErrorMessage(error: ParseErr): string {
    switch (error.tag) {
      case "Expected":
        return `  Expected: ${error.items.join(" or ")}`;
      case "Unexpected":
        return `  Unexpected: ${error.found}`;
      case "Custom":
        return `  ${error.message}`;
    }
  }
}

// Usage
const formatter = new ErrorFormatter("ansi", { showHints: true });
const errorMessage = formatter.format(errorBundle);
console.log(errorMessage);
```

## 6. Generator-Friendly Error Handling

### Implementation

```ts
// Enhanced generator syntax with try/catch support
export function parserWithTryCatch<T, Ctx = {}>(
  f: () => Generator<Parser<any, Ctx>, T, any>
): Parser<T, Ctx> {
  return new Parser((state) => {
    const iterator = f();
    let current = iterator.next();
    let currentState = state;
    const errors: ParseErr[] = [];

    while (!current.done) {
      try {
        const { result, state: newState } = current.value.run(currentState);
        if (Either.isLeft(result)) {
          errors.push(result.left);
          // Allow generator to handle error
          current = iterator.throw(result.left);
          continue;
        }
        currentState = newState;
        current = iterator.next(result.right);
      } catch (error) {
        if (error instanceof ParseErr) {
          errors.push(error);
          return Parser.fail({ errors }, currentState);
        }
        throw error; // Re-throw non-parser errors
      }
    }

    return Parser.succeed(current.value, currentState);
  });
}

// Usage
const robustParser = parserWithTryCatch(function* () {
  try {
    const name = yield* identifier.label("function name");
    yield* char("(").label("opening paren");

    const args = yield* sepBy(char(","), expression).label("arguments");

    yield* char(")").label("closing paren");

    return { type: "FunctionCall", name, args };
  } catch (error: ParseErr) {
    // Add context and re-throw
    const contextualError: ParseErr = {
      ...error,
      context: [...error.context, "function call"],
    };
    throw contextualError;
  }
});
```

## 7. Usage Examples & Integration

### Enhanced Scheme Parser with Rich Errors

```ts
// Enhanced parser with all error improvements
const enhancedExpr = Parser.lazy(() =>
  or(
    boolean.label("boolean literal"),
    number.label("number literal"),
    stringLiteral.label("string literal"),
    symbol.label("symbol"),
    listParser.label("list expression")
  ).label("expression")
);

const enhancedLambda = parserWithTryCatch(function* () {
  try {
    yield* char("(").label("opening parenthesis");
    yield* keywordWithHints(["lambda", "let", "if"])("lambda");

    yield* char("(").label("parameter list start");
    const params = yield* many0(symbol).label("parameters");
    yield* char(")").label("parameter list end");

    const body = yield* enhancedExpr.label("lambda body");
    yield* char(")").label("closing parenthesis");

    return LispExpr.lambda(
      params.map((p) => p.name),
      body
    );
  } catch (error: ParseErr) {
    throw {
      ...error,
      context: [...error.context, "lambda expression"],
    };
  }
});

// Usage with comprehensive error reporting
const result = enhancedLambda.parse("(lamdba (x) (+ x y))");
if (result.result._tag === "Left") {
  const formatter = new ErrorFormatter("ansi");
  console.log(formatter.format(result.result.left));
}
```

**Expected Output:**

```
Error at line 1, column 2:
  (lamdba (x) (+ x y))
   ^
  Unexpected: lamdba
  Expected: lambda keyword

  Did you mean: lambda?

  Context: expression > lambda expression > lambda keyword
```

## 8. Migration Strategy

### Phase 1: Internal Error System

1. Implement `ParseErr` and `ParseErrorBundle` alongside existing `ParserError`
2. Add feature flag to switch between old/new error systems
3. Migrate core combinators to use new system internally

### Phase 2: Enhanced Combinators

1. Add `.label()` and `.expect()` methods
2. Implement `attempt()`, `recover()`, `skipUntilSync()`
3. Add hint generation for string/keyword parsers

### Phase 3: User-Facing Improvements

1. Expose `ErrorFormatter` with multiple output formats
2. Add `parserWithTryCatch` for generator syntax
3. Provide migration guide and examples

### Backwards Compatibility

```ts
// Adapter to maintain compatibility
export function legacyError(bundle: ParseErrorBundle): ParserError {
  const primary = bundle.primary;
  return new ParserError(
    primary.tag === "Custom"
      ? primary.message
      : `${primary.tag}: ${JSON.stringify(primary)}`,
    primary.tag === "Expected" ? primary.items : [],
    primary.tag === "Unexpected" ? primary.found : undefined
  );
}
```

This implementation provides a world-class error system that rivals Haskell's megaparsec while maintaining parserator's TypeScript-first, generator-friendly API. The improvements offer precise error locations, intelligent suggestions, graceful error recovery, and beautiful formatting—all while keeping the migration path smooth for existing users.
