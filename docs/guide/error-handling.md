# Error Handling

Parser error messages are crucial for user experience. Parserator provides tools to make errors helpful, actionable, and visually clear.

## Basic Error Structure

When a parser fails, it returns a `ParseErrorBundle` containing detailed information about the failure.

```typescript
// ParseError types (simplified)
type ParseError =
  | ExpectedParseError // Expected X, found Y
  | UnexpectedParseError // Unexpected X (often with hints)
  | CustomParseError // Custom message using .expect()
  | FatalParseError; // Unrecoverable error using Parser.fatal()

// ParseErrorBundle contains:
// - errors: ParseError[]    All errors encountered during parsing
// - primary: ParseError     The "furthest" error (most likely the relevant one)
// - source: string          The original input string
```

The `primary` error is determined by the highest offset in the input, which usually points to where the syntax actually diverged from the grammar.

## Adding Context with `label()`

Use `.label()` to group small parsers into logical concepts. This makes error messages much more readable by replacing raw expectations with descriptive names.

```typescript
const identifier = many1(alphabet).label("identifier");
const digitValue = many1(digit).label("number");

// Without label: "Expected [a-z] or [A-Z]"
// With label: "Expected identifier"
```

Labels also form a **context stack** that shows up in formatted error messages, helping users understand where they are in a complex grammar.

## Custom Messages with `expect()`

The `.expect(message)` method allows you to provide a specific error message if a parser fails. This is particularly useful for mandatory syntax elements like delimiters.

```typescript
const point = parser(function* () {
  yield* char("(").expect("opening parenthesis");
  const x = yield* number;
  yield* char(",").expect("comma between coordinates");
  const y = yield* number;
  yield* char(")").expect("closing parenthesis");
  return { x, y };
});

// Error on input "(10 20)":
// "Expected comma between coordinates at line 1, column 5"
```

## Commit for Better Errors

By default, the `or()` combinator tries every branch. If all fail, it might report a generic error listing every possibility. Use `commit()` once you've successfully identified which branch the input _should_ be.

### Without Commit

```typescript
const statement = or(ifStatement, whileStatement, assignment);
// Error on "if (x > 5":
// "Expected if, while, or assignment" (generic)
```

### With Commit

```typescript
const ifStatement = parser(function* () {
  yield* string("if");
  yield* commit(); // Once we see 'if', we are committed to this branch
  yield* char("(").expect("opening parenthesis after 'if'");
  // ...
});

// Error on "if (x > 5":
// "Expected opening parenthesis after 'if'" (specific)
```

## Formatting Errors

Parserator includes a powerful `ErrorFormatter` that supports multiple output formats.

```typescript
import { formatError } from "parserator";

// Convenience functions for different formats
const plain = formatError.plain(bundle); // Clean text
const ansi = formatError.ansi(bundle); // Terminal colors & snippets
const html = formatError.html(bundle); // Styled HTML markup
const json = formatError.json(bundle); // Programmatic structure
```

### ANSI Output Example

The `ansi` formatter provides a visual snippet of the source code with a pointer to the error location:

```text
Error at line 2, column 15:
  1 | function foo() {
> 2 |   return x +
               ^
  3 | }

  Expected: expression after '+'
```

## Typo Suggestions with Hints

Parserator can suggest corrections for typos using Levenshtein distance. This is built into special keyword parsers.

```typescript
import { anyKeywordWithHints } from "parserator";

const keywords = ["function", "const", "let", "var", "class"];
const keywordParser = anyKeywordWithHints(keywords);

// Input: "functoin"
// Error: Unexpected functoin
// Hint: Did you mean: function?
```

## Error Recovery Patterns

### Strategic Fallbacks

You can provide recovery points by matching "bad" input and returning an error node in your AST.

```typescript
const statement = or(
  validStatement,
  // Error recovery: skip until semicolon to stay in sync
  takeUntil(char(";")).map(() => ({ type: "error" }))
);
```

### Collecting All Options

When using `or()`, giving each branch a label ensures that the user sees all valid options if everything fails.

```typescript
const value = or(
  number.label("number"),
  stringLiteral.label("string"),
  identifier.label("identifier")
);
// Error: "Expected number, string, or identifier"
```

## Fatal Errors

Sometimes you encounter a state where parsing should stop immediately, even if this parser is inside an `or()` or `optional()`. Use `Parser.fatal()` for these cases.

```typescript
const config = parser(function* () {
  const version = yield* number;
  if (version > 3) {
    // This cannot be recovered from by backtracking
    return yield* Parser.fatal("Unsupported config version");
  }
  // ...
});
```

## Best Practices

1.  **Label your atoms**: Give names like "identifier" or "number" to your base parsers.
2.  **Use `expect()` on delimiters**: Closing braces, semicolons, and commas should have descriptive error messages.
3.  **Commit early**: Once a keyword or unique starting character is matched, use `commit()` to lock in that branch.
4.  **Use hint-enabled parsers**: Especially for keyword-heavy languages, hint parsers significantly improve DX.
5.  **Test your errors**: Assert on the error messages produced by invalid inputs to ensure they are helpful.
