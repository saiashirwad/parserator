# API Documentation

## src/state.ts

### State

**Type:** variable

Utility object containing static methods for creating and manipulating parser state.

*Defined in [src/state.ts:35](src/state.ts#L35)*

---

### unknown

**Type:** unknown

Utility object containing static methods for creating and manipulating parser state.

*Defined in [src/state.ts:35](src/state.ts#L35)*

---

### fromInput

**Type:** method

Creates a new parser state from an input string.

**Parameters:**

- `input`: The input string to parse

**Returns:** A new parser state initialized at the start of the input

*Defined in [src/state.ts:42](src/state.ts#L42)*

---

### unknown

**Type:** unknown

Creates a new parser state from an input string.

**Parameters:**

- `input`: The input string to parse

**Returns:** A new parser state initialized at the start of the input

*Defined in [src/state.ts:42](src/state.ts#L42)*

---

### consume

**Type:** method

Creates a new state by consuming n characters from the current state.

**Parameters:**

- `state`: The current parser state
- `n`: Number of characters to consume

**Returns:** A new state with n characters consumed and position updated

*Defined in [src/state.ts:54](src/state.ts#L54)*

---

### unknown

**Type:** unknown

Creates a new state by consuming n characters from the current state.

**Parameters:**

- `state`: The current parser state
- `n`: Number of characters to consume

**Returns:** A new state with n characters consumed and position updated

*Defined in [src/state.ts:54](src/state.ts#L54)*

---

### consumeString

**Type:** method

Creates a new state by consuming a specific string from the current state.

**Parameters:**

- `state`: The current parser state
- `str`: The string to consume

**Returns:** A new state with the string consumed and position updated

*Defined in [src/state.ts:88](src/state.ts#L88)*

---

### unknown

**Type:** unknown

Creates a new state by consuming a specific string from the current state.

**Parameters:**

- `state`: The current parser state
- `str`: The string to consume

**Returns:** A new state with the string consumed and position updated

*Defined in [src/state.ts:88](src/state.ts#L88)*

---

### consumeWhile

**Type:** method

Creates a new state by consuming characters while a predicate is true.

**Parameters:**

- `state`: The current parser state
- `predicate`: Function that tests each character

**Returns:** A new state with matching characters consumed

*Defined in [src/state.ts:109](src/state.ts#L109)*

---

### unknown

**Type:** unknown

Creates a new state by consuming characters while a predicate is true.

**Parameters:**

- `state`: The current parser state
- `predicate`: Function that tests each character

**Returns:** A new state with matching characters consumed

*Defined in [src/state.ts:109](src/state.ts#L109)*

---

### peek

**Type:** method

Gets the next n characters from the input without consuming them.

**Parameters:**

- `state`: The current parser state
- `n`: Number of characters to peek (default: 1)

**Returns:** The next n characters as a string

*Defined in [src/state.ts:127](src/state.ts#L127)*

---

### unknown

**Type:** unknown

Gets the next n characters from the input without consuming them.

**Parameters:**

- `state`: The current parser state
- `n`: Number of characters to peek (default: 1)

**Returns:** The next n characters as a string

*Defined in [src/state.ts:127](src/state.ts#L127)*

---

### isAtEnd

**Type:** method

Checks if the parser has reached the end of input.

**Parameters:**

- `state`: The current parser state

**Returns:** True if at end of input, false otherwise

*Defined in [src/state.ts:137](src/state.ts#L137)*

---

### unknown

**Type:** unknown

Checks if the parser has reached the end of input.

**Parameters:**

- `state`: The current parser state

**Returns:** True if at end of input, false otherwise

*Defined in [src/state.ts:137](src/state.ts#L137)*

---

## src/hints.ts

### levenshteinDistance

**Type:** function

Calculate the Levenshtein distance between two strings.This measures the minimum number of single-character edits (insertions, deletions, or substitutions)required to change one string into another.

**Parameters:**

- `a`: The first string
- `b`: The second string

**Returns:** The edit distance between the strings

*Defined in [src/hints.ts:14](src/hints.ts#L14)*

---

### unknown

**Type:** unknown

Calculate the Levenshtein distance between two strings.This measures the minimum number of single-character edits (insertions, deletions, or substitutions)required to change one string into another.

**Parameters:**

- `a`: The first string
- `b`: The second string

**Returns:** The edit distance between the strings

*Defined in [src/hints.ts:14](src/hints.ts#L14)*

---

### generateHints

**Type:** function

Generate helpful hints for a user's input based on a list of expected values.Uses edit distance to find the closest matches and suggests them as "Did you mean..." options.

**Parameters:**

- `found`: The string the user actually typed
- `expected`: Array of valid/expected strings
- `maxDistance`: Maximum edit distance to consider (default: 2)
- `maxHints`: Maximum number of hints to return (default: 3)

**Returns:** Array of suggested strings, sorted by edit distance

*Defined in [src/hints.ts:48](src/hints.ts#L48)*

---

### unknown

**Type:** unknown

Generate helpful hints for a user's input based on a list of expected values.Uses edit distance to find the closest matches and suggests them as "Did you mean..." options.

**Parameters:**

- `found`: The string the user actually typed
- `expected`: Array of valid/expected strings
- `maxDistance`: Maximum edit distance to consider (default: 2)
- `maxHints`: Maximum number of hints to return (default: 3)

**Returns:** Array of suggested strings, sorted by edit distance

*Defined in [src/hints.ts:48](src/hints.ts#L48)*

---

### keywordWithHints

**Type:** variable

Enhanced keyword parser that provides intelligent hints when the user types something similar.

**Parameters:**

- `keywords`: Array of valid keywords to match against

**Returns:** A function that creates a parser for a specific keyword with hint generation

**Examples:**

```typescript
const schemeKeywords = ["lambda", "let", "if", "cond", "define", "quote"]
const lambdaParser = keywordWithHints(schemeKeywords)("lambda")

// Parsing "lamdba" will suggest "lambda" as a hint
const result = lambdaParser.parse("lamdba")
```

*Defined in [src/hints.ts:84](src/hints.ts#L84)*

---

### unknown

**Type:** unknown

Enhanced keyword parser that provides intelligent hints when the user types something similar.

**Parameters:**

- `keywords`: Array of valid keywords to match against

**Returns:** A function that creates a parser for a specific keyword with hint generation

**Examples:**

```typescript
const schemeKeywords = ["lambda", "let", "if", "cond", "define", "quote"]
const lambdaParser = keywordWithHints(schemeKeywords)("lambda")

// Parsing "lamdba" will suggest "lambda" as a hint
const result = lambdaParser.parse("lamdba")
```

*Defined in [src/hints.ts:84](src/hints.ts#L84)*

---

### anyKeywordWithHints

**Type:** function

Creates a parser that matches any of the provided keywords with hint generation.

**Parameters:**

- `keywords`: Array of valid keywords

**Returns:** A parser that matches any keyword and provides hints for typos

**Examples:**

```typescript
const jsKeywords = ["function", "const", "let", "var", "class", "if", "else"]
const keywordParser = anyKeywordWithHints(jsKeywords)

// Parsing "functoin" will suggest "function"
const result = keywordParser.parse("functoin")
```

*Defined in [src/hints.ts:122](src/hints.ts#L122)*

---

### unknown

**Type:** unknown

Creates a parser that matches any of the provided keywords with hint generation.

**Parameters:**

- `keywords`: Array of valid keywords

**Returns:** A parser that matches any keyword and provides hints for typos

**Examples:**

```typescript
const jsKeywords = ["function", "const", "let", "var", "class", "if", "else"]
const keywordParser = anyKeywordWithHints(jsKeywords)

// Parsing "functoin" will suggest "function"
const result = keywordParser.parse("functoin")
```

*Defined in [src/hints.ts:122](src/hints.ts#L122)*

---

### stringWithHints

**Type:** function

Creates a parser for string literals with hint generation for common mistakes.

**Parameters:**

- `validStrings`: Array of valid string values

**Returns:** A parser that matches quoted strings and provides hints for typos

**Examples:**

```typescript
const colorParser = stringWithHints(["red", "green", "blue", "yellow"])

// Parsing '"gren"' will suggest "green"
const result = colorParser.parse('"gren"')
```

*Defined in [src/hints.ts:163](src/hints.ts#L163)*

---

### unknown

**Type:** unknown

Creates a parser for string literals with hint generation for common mistakes.

**Parameters:**

- `validStrings`: Array of valid string values

**Returns:** A parser that matches quoted strings and provides hints for typos

**Examples:**

```typescript
const colorParser = stringWithHints(["red", "green", "blue", "yellow"])

// Parsing '"gren"' will suggest "green"
const result = colorParser.parse('"gren"')
```

*Defined in [src/hints.ts:163](src/hints.ts#L163)*

---

## src/debug.ts

### debugState

**Type:** function

Creates a debug output for a parser's current state and result

*Defined in [src/debug.ts:7](src/debug.ts#L7)*

---

### unknown

**Type:** unknown

Creates a debug output for a parser's current state and result

*Defined in [src/debug.ts:7](src/debug.ts#L7)*

---

### debug

**Type:** function

Adds debug output to a parser

*Defined in [src/debug.ts:40](src/debug.ts#L40)*

---

### unknown

**Type:** unknown

Adds debug output to a parser

*Defined in [src/debug.ts:40](src/debug.ts#L40)*

---

### trace

**Type:** function

Creates a parser that logs its input state and continues

*Defined in [src/debug.ts:47](src/debug.ts#L47)*

---

### unknown

**Type:** unknown

Creates a parser that logs its input state and continues

*Defined in [src/debug.ts:47](src/debug.ts#L47)*

---

### breakpoint

**Type:** function

Adds breakpoints to a parser for step-by-step debugging

*Defined in [src/debug.ts:59](src/debug.ts#L59)*

---

### unknown

**Type:** unknown

Adds breakpoints to a parser for step-by-step debugging

*Defined in [src/debug.ts:59](src/debug.ts#L59)*

---

### benchmark

**Type:** function

Times how long a parser takes to run

*Defined in [src/debug.ts:70](src/debug.ts#L70)*

---

### unknown

**Type:** unknown

Times how long a parser takes to run

*Defined in [src/debug.ts:70](src/debug.ts#L70)*

---

## src/parser.ts

### unknown

**Type:** unknown



*Defined in [src/parser.ts:20](src/parser.ts#L20)*

---

### unknown

**Type:** unknown



*Defined in [src/parser.ts:20](src/parser.ts#L20)*

---

### withError

**Type:** method

Adds an error message to the parser

**Parameters:**

- `makeMessage`: A function that returns an error message

**Returns:** A new parser with the error message added

*Defined in [src/parser.ts:85](src/parser.ts#L85)*

---

### unknown

**Type:** unknown

Adds an error message to the parser

**Parameters:**

- `makeMessage`: A function that returns an error message

**Returns:** A new parser with the error message added

*Defined in [src/parser.ts:85](src/parser.ts#L85)*

---

### lazy

**Type:** method

Creates a new parser that lazily evaluates the given function.This is useful for creating recursive parsers.

**Parameters:**

- `fn`: A function that returns a parser

**Returns:** A new parser that evaluates the function when parsing T The type of value produced by the parser

**Examples:**

```typescript
// Create a recursive parser for nested parentheses
const parens: Parser<string> = Parser.lazy(() =>
  between(
    char('('),
    char(')'),
    parens
  )
)
```

*Defined in [src/parser.ts:192](src/parser.ts#L192)*

---

### unknown

**Type:** unknown

Creates a new parser that lazily evaluates the given function.This is useful for creating recursive parsers.

**Parameters:**

- `fn`: A function that returns a parser

**Returns:** A new parser that evaluates the function when parsing T The type of value produced by the parser

**Examples:**

```typescript
// Create a recursive parser for nested parentheses
const parens: Parser<string> = Parser.lazy(() =>
  between(
    char('('),
    char(')'),
    parens
  )
)
```

*Defined in [src/parser.ts:192](src/parser.ts#L192)*

---

### tap

**Type:** method

Adds a tap point to observe the current state and result during parsing.Useful for debugging parser behavior.

**Parameters:**

- `callback`: Function called with current state and result

**Returns:** The same parser with the tap point added

*Defined in [src/parser.ts:263](src/parser.ts#L263)*

---

### unknown

**Type:** unknown

Adds a tap point to observe the current state and result during parsing.Useful for debugging parser behavior.

**Parameters:**

- `callback`: Function called with current state and result

**Returns:** The same parser with the tap point added

*Defined in [src/parser.ts:263](src/parser.ts#L263)*

---

### label

**Type:** method

Adds a label to this parser for better error messages

**Parameters:**

- `name`: The label name to add to the context stack

**Returns:** A new parser with the label added

*Defined in [src/parser.ts:314](src/parser.ts#L314)*

---

### unknown

**Type:** unknown

Adds a label to this parser for better error messages

**Parameters:**

- `name`: The label name to add to the context stack

**Returns:** A new parser with the label added

*Defined in [src/parser.ts:314](src/parser.ts#L314)*

---

### expect

**Type:** method

Helper for creating semantic expectations with both label and error message

**Parameters:**

- `description`: The description for both the label and error message

**Returns:** A new parser with both labeling and error message

*Defined in [src/parser.ts:344](src/parser.ts#L344)*

---

### unknown

**Type:** unknown

Helper for creating semantic expectations with both label and error message

**Parameters:**

- `description`: The description for both the label and error message

**Returns:** A new parser with both labeling and error message

*Defined in [src/parser.ts:344](src/parser.ts#L344)*

---

### failRich

**Type:** method

Helper for creating semantic expectations with both label and error message

**Parameters:**

- `errorBundle`: The error bundle containing the errors to be displayed
- `state`: The current parser state

**Returns:** A parser output with the error bundle and the current state

*Defined in [src/parser.ts:354](src/parser.ts#L354)*

---

### unknown

**Type:** unknown

Helper for creating semantic expectations with both label and error message

**Parameters:**

- `errorBundle`: The error bundle containing the errors to be displayed
- `state`: The current parser state

**Returns:** A parser output with the error bundle and the current state

*Defined in [src/parser.ts:354](src/parser.ts#L354)*

---

### commit

**Type:** method

Commits to the current parsing path, preventing backtracking beyond this point.Once a parser is committed, if it fails later in the sequence, the error won'tbacktrack to try other alternatives in a  or  combinator. This leadsto more specific error messages instead of generic "expected one of" errors.

**Returns:** A new parser that sets the commit flag after successful parsing

**Examples:**

```typescript
// Use commit after matching a keyword to ensure specific error messages
const ifStatement = Parser.gen(function* () {
  yield* keyword("if")
  yield* commit()  // After seeing "if", we know it's an if statement
  yield* char('(').expect("opening parenthesis after 'if'")
  const condition = yield* expression
  yield* char(')').expect("closing parenthesis")
  const body = yield* block
  return { type: "if", condition, body }
})

// In a choice, commit prevents backtracking
const statement = choice([
  ifStatement,
  whileStatement,
  assignment
])

// Input: "if x > 5 {}"  (missing parentheses)
// Without commit: "Expected if, while, or assignment"
// With commit: "Expected opening parenthesis after 'if'"
```

```typescript
// Commit can be chained with other methods
const jsonObject = char('{')
  .commit()  // Once we see '{', it must be an object
  .then(whitespace)
  .then(objectContent)
  .expect("valid JSON object")
```

*Defined in [src/parser.ts:413](src/parser.ts#L413)*

---

### unknown

**Type:** unknown

Commits to the current parsing path, preventing backtracking beyond this point.Once a parser is committed, if it fails later in the sequence, the error won'tbacktrack to try other alternatives in a  or  combinator. This leadsto more specific error messages instead of generic "expected one of" errors.

**Returns:** A new parser that sets the commit flag after successful parsing

**Examples:**

```typescript
// Use commit after matching a keyword to ensure specific error messages
const ifStatement = Parser.gen(function* () {
  yield* keyword("if")
  yield* commit()  // After seeing "if", we know it's an if statement
  yield* char('(').expect("opening parenthesis after 'if'")
  const condition = yield* expression
  yield* char(')').expect("closing parenthesis")
  const body = yield* block
  return { type: "if", condition, body }
})

// In a choice, commit prevents backtracking
const statement = choice([
  ifStatement,
  whileStatement,
  assignment
])

// Input: "if x > 5 {}"  (missing parentheses)
// Without commit: "Expected if, while, or assignment"
// With commit: "Expected opening parenthesis after 'if'"
```

```typescript
// Commit can be chained with other methods
const jsonObject = char('{')
  .commit()  // Once we see '{', it must be an object
  .then(whitespace)
  .then(objectContent)
  .expect("valid JSON object")
```

*Defined in [src/parser.ts:413](src/parser.ts#L413)*

---

### atomic

**Type:** method

Creates an atomic parser that either fully succeeds or resets to the original state.This is useful for "all-or-nothing" parsing where you want to try a complexparser but not consume any input if it fails. The parser acts as a transaction -if any part fails, the entire parse is rolled back.

**Returns:** A new parser that resets state on failure

**Examples:**

```typescript
// Without atomic - partial consumption on failure
const badParser = Parser.gen(function* () {
  yield* string("foo")
  yield* string("bar")  // If this fails, "foo" is already consumed
})

// With atomic - no consumption on failure
const goodParser = Parser.gen(function* () {
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
```

*Defined in [src/parser.ts:476](src/parser.ts#L476)*

---

### unknown

**Type:** unknown

Creates an atomic parser that either fully succeeds or resets to the original state.This is useful for "all-or-nothing" parsing where you want to try a complexparser but not consume any input if it fails. The parser acts as a transaction -if any part fails, the entire parse is rolled back.

**Returns:** A new parser that resets state on failure

**Examples:**

```typescript
// Without atomic - partial consumption on failure
const badParser = Parser.gen(function* () {
  yield* string("foo")
  yield* string("bar")  // If this fails, "foo" is already consumed
})

// With atomic - no consumption on failure
const goodParser = Parser.gen(function* () {
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
```

*Defined in [src/parser.ts:476](src/parser.ts#L476)*

---

## src/error-formatter.ts

### ErrorFormatter

**Type:** class

Formats ParseErrorBundle into human-readable error messages with multiple output formats.Supports plain text, ANSI colors, HTML, and JSON formats.

*Defined in [src/error-formatter.ts:17](src/error-formatter.ts#L17)*

---

### unknown

**Type:** unknown

Formats ParseErrorBundle into human-readable error messages with multiple output formats.Supports plain text, ANSI colors, HTML, and JSON formats.

*Defined in [src/error-formatter.ts:17](src/error-formatter.ts#L17)*

---

### format

**Type:** method

Format a ParseErrorBundle into a string based on the configured format.

**Parameters:**

- `bundle`: The error bundle to format

**Returns:** Formatted error message string

*Defined in [src/error-formatter.ts:40](src/error-formatter.ts#L40)*

---

### unknown

**Type:** unknown

Format a ParseErrorBundle into a string based on the configured format.

**Parameters:**

- `bundle`: The error bundle to format

**Returns:** Formatted error message string

*Defined in [src/error-formatter.ts:40](src/error-formatter.ts#L40)*

---

### formatAnsi

**Type:** method

Format error with ANSI color codes for terminal output.

*Defined in [src/error-formatter.ts:56](src/error-formatter.ts#L56)*

---

### unknown

**Type:** unknown

Format error with ANSI color codes for terminal output.

*Defined in [src/error-formatter.ts:56](src/error-formatter.ts#L56)*

---

### formatPlain

**Type:** method

Format error as plain text without colors.

*Defined in [src/error-formatter.ts:109](src/error-formatter.ts#L109)*

---

### unknown

**Type:** unknown

Format error as plain text without colors.

*Defined in [src/error-formatter.ts:109](src/error-formatter.ts#L109)*

---

### formatHtml

**Type:** method

Format error as HTML with styling.

*Defined in [src/error-formatter.ts:161](src/error-formatter.ts#L161)*

---

### unknown

**Type:** unknown

Format error as HTML with styling.

*Defined in [src/error-formatter.ts:161](src/error-formatter.ts#L161)*

---

### formatJson

**Type:** method

Format error as JSON for programmatic consumption.

*Defined in [src/error-formatter.ts:227](src/error-formatter.ts#L227)*

---

### unknown

**Type:** unknown

Format error as JSON for programmatic consumption.

*Defined in [src/error-formatter.ts:227](src/error-formatter.ts#L227)*

---

### formatErrorMessage

**Type:** method

Format the error message based on error type.

*Defined in [src/error-formatter.ts:273](src/error-formatter.ts#L273)*

---

### unknown

**Type:** unknown

Format the error message based on error type.

*Defined in [src/error-formatter.ts:273](src/error-formatter.ts#L273)*

---

### getPlainErrorMessage

**Type:** method

Get plain error message without formatting.

*Defined in [src/error-formatter.ts:293](src/error-formatter.ts#L293)*

---

### unknown

**Type:** unknown

Get plain error message without formatting.

*Defined in [src/error-formatter.ts:293](src/error-formatter.ts#L293)*

---

### createPointer

**Type:** method

Create a pointer/caret pointing to the error location.

*Defined in [src/error-formatter.ts:309](src/error-formatter.ts#L309)*

---

### unknown

**Type:** unknown

Create a pointer/caret pointing to the error location.

*Defined in [src/error-formatter.ts:309](src/error-formatter.ts#L309)*

---

### getContextLines

**Type:** method

Get context lines around the error location.

*Defined in [src/error-formatter.ts:320](src/error-formatter.ts#L320)*

---

### unknown

**Type:** unknown

Get context lines around the error location.

*Defined in [src/error-formatter.ts:320](src/error-formatter.ts#L320)*

---

### escapeHtml

**Type:** method

Escape HTML entities.

*Defined in [src/error-formatter.ts:341](src/error-formatter.ts#L341)*

---

### unknown

**Type:** unknown

Escape HTML entities.

*Defined in [src/error-formatter.ts:341](src/error-formatter.ts#L341)*

---

### withOptions

**Type:** method

Create a new formatter with different options.

*Defined in [src/error-formatter.ts:353](src/error-formatter.ts#L353)*

---

### unknown

**Type:** unknown

Create a new formatter with different options.

*Defined in [src/error-formatter.ts:353](src/error-formatter.ts#L353)*

---

### withFormat

**Type:** method

Create a new formatter with a different format.

*Defined in [src/error-formatter.ts:360](src/error-formatter.ts#L360)*

---

### unknown

**Type:** unknown

Create a new formatter with a different format.

*Defined in [src/error-formatter.ts:360](src/error-formatter.ts#L360)*

---

### getHints

**Type:** method

Get hints from an error, handling the union type safely.

*Defined in [src/error-formatter.ts:367](src/error-formatter.ts#L367)*

---

### unknown

**Type:** unknown

Get hints from an error, handling the union type safely.

*Defined in [src/error-formatter.ts:367](src/error-formatter.ts#L367)*

---

### formatError

**Type:** variable

Convenience functions for quick formatting.

*Defined in [src/error-formatter.ts:381](src/error-formatter.ts#L381)*

---

### unknown

**Type:** unknown

Convenience functions for quick formatting.

*Defined in [src/error-formatter.ts:381](src/error-formatter.ts#L381)*

---

## src/combinators.ts

### lookahead

**Type:** function

Creates a parser that looks ahead in the input stream without consuming any input.The parser will succeed with the result of the given parser but won't advance the input position.

**Parameters:**

- `parser`: The parser to look ahead with

**Returns:** A new parser that peeks at the input without consuming it

**Examples:**

```typescript
const parser = lookahead(char('a'))
parser.run('abc') // Right(['a', {...}])
// Input position remains at 'abc', 'a' is not consumed
```

*Defined in [src/combinators.ts:18](src/combinators.ts#L18)*

---

### unknown

**Type:** unknown

Creates a parser that looks ahead in the input stream without consuming any input.The parser will succeed with the result of the given parser but won't advance the input position.

**Parameters:**

- `parser`: The parser to look ahead with

**Returns:** A new parser that peeks at the input without consuming it

**Examples:**

```typescript
const parser = lookahead(char('a'))
parser.run('abc') // Right(['a', {...}])
// Input position remains at 'abc', 'a' is not consumed
```

*Defined in [src/combinators.ts:18](src/combinators.ts#L18)*

---

### notFollowedBy

**Type:** function

Creates a parser that succeeds only if the given parser fails to match.If the parser succeeds, this parser fails with an error message.

**Parameters:**

- `parser`: The parser that should not match

**Returns:** A new parser that succeeds only if the input parser fails

**Examples:**

```typescript
const notA = notFollowedBy(char('a'))
notA.run('bcd') // Right([true, {...}]) - Succeeds because 'a' is not found
notA.run('abc') // Left(error) - Fails because 'a' is found
```

*Defined in [src/combinators.ts:40](src/combinators.ts#L40)*

---

### unknown

**Type:** unknown

Creates a parser that succeeds only if the given parser fails to match.If the parser succeeds, this parser fails with an error message.

**Parameters:**

- `parser`: The parser that should not match

**Returns:** A new parser that succeeds only if the input parser fails

**Examples:**

```typescript
const notA = notFollowedBy(char('a'))
notA.run('bcd') // Right([true, {...}]) - Succeeds because 'a' is not found
notA.run('abc') // Left(error) - Fails because 'a' is found
```

*Defined in [src/combinators.ts:40](src/combinators.ts#L40)*

---

### string

**Type:** variable

Creates a parser that matches an exact string in the input.

**Parameters:**

- `str`: The string to match

**Returns:** A parser that matches and consumes the exact string

**Examples:**

```typescript
const parser = string("hello")
parser.run("hello world") // Right(["hello", {...}])
parser.run("goodbye") // Left(error)
```

*Defined in [src/combinators.ts:68](src/combinators.ts#L68)*

---

### unknown

**Type:** unknown

Creates a parser that matches an exact string in the input.

**Parameters:**

- `str`: The string to match

**Returns:** A parser that matches and consumes the exact string

**Examples:**

```typescript
const parser = string("hello")
parser.run("hello world") // Right(["hello", {...}])
parser.run("goodbye") // Left(error)
```

*Defined in [src/combinators.ts:68](src/combinators.ts#L68)*

---

### narrowedString

**Type:** function

Creates a parser that matches an exact string literal type.Similar to string parser but preserves the literal type information.

**Parameters:**

- `str`: The string literal to match

**Returns:** A parser that matches and consumes the exact string with preserved type

**Examples:**

```typescript
const parser = narrowedString("hello") // Parser<"hello">
parser.run("hello world") // Right(["hello", {...}])
parser.run("goodbye") // Left(error)
```

*Defined in [src/combinators.ts:97](src/combinators.ts#L97)*

---

### unknown

**Type:** unknown

Creates a parser that matches an exact string literal type.Similar to string parser but preserves the literal type information.

**Parameters:**

- `str`: The string literal to match

**Returns:** A parser that matches and consumes the exact string with preserved type

**Examples:**

```typescript
const parser = narrowedString("hello") // Parser<"hello">
parser.run("hello world") // Right(["hello", {...}])
parser.run("goodbye") // Left(error)
```

*Defined in [src/combinators.ts:97](src/combinators.ts#L97)*

---

### char

**Type:** variable

Creates a parser that matches a single character.

**Parameters:**

- `ch`: The character to match

**Returns:** A parser that matches and consumes a single character

**Examples:**

```typescript
const parser = char("a")
parser.run("abc") // Right(["a", {...}])
parser.run("xyz") // Left(error)
```

*Defined in [src/combinators.ts:112](src/combinators.ts#L112)*

---

### unknown

**Type:** unknown

Creates a parser that matches a single character.

**Parameters:**

- `ch`: The character to match

**Returns:** A parser that matches and consumes a single character

**Examples:**

```typescript
const parser = char("a")
parser.run("abc") // Right(["a", {...}])
parser.run("xyz") // Left(error)
```

*Defined in [src/combinators.ts:112](src/combinators.ts#L112)*

---

### alphabet

**Type:** variable

A parser that matches any single alphabetic character (a-z, A-Z).

**Examples:**

```typescript
const parser = alphabet
parser.run("abc") // Right(["a", {...}])
parser.run("123") // Left(error)
```

*Defined in [src/combinators.ts:138](src/combinators.ts#L138)*

---

### unknown

**Type:** unknown

A parser that matches any single alphabetic character (a-z, A-Z).

**Examples:**

```typescript
const parser = alphabet
parser.run("abc") // Right(["a", {...}])
parser.run("123") // Left(error)
```

*Defined in [src/combinators.ts:138](src/combinators.ts#L138)*

---

### digit

**Type:** variable

A parser that matches any single digit character (0-9).

**Examples:**

```typescript
const parser = digit
parser.run("123") // Right(["1", {...}])
parser.run("abc") // Left(error)
```

*Defined in [src/combinators.ts:162](src/combinators.ts#L162)*

---

### unknown

**Type:** unknown

A parser that matches any single digit character (0-9).

**Examples:**

```typescript
const parser = digit
parser.run("123") // Right(["1", {...}])
parser.run("abc") // Left(error)
```

*Defined in [src/combinators.ts:162](src/combinators.ts#L162)*

---

### sepBy

**Type:** function

Creates a parser that matches zero or more occurrences of elements separated by a separator.

**Parameters:**

- `sepParser`: Parser for the separator between elements
- `parser`: Parser for the elements

**Returns:** A parser that produces an array of matched elements

**Examples:**

```typescript
const parser = sepBy(char(','), digit)
parser.run("1,2,3") // Right([["1", "2", "3"], {...}])
parser.run("") // Right([[], {...}])
```

*Defined in [src/combinators.ts:191](src/combinators.ts#L191)*

---

### unknown

**Type:** unknown

Creates a parser that matches zero or more occurrences of elements separated by a separator.

**Parameters:**

- `sepParser`: Parser for the separator between elements
- `parser`: Parser for the elements

**Returns:** A parser that produces an array of matched elements

**Examples:**

```typescript
const parser = sepBy(char(','), digit)
parser.run("1,2,3") // Right([["1", "2", "3"], {...}])
parser.run("") // Right([[], {...}])
```

*Defined in [src/combinators.ts:191](src/combinators.ts#L191)*

---

### sepBy1

**Type:** function

Parses one or more occurrences of a parser separated by another parser.Requires at least one match of the main parser.

**Parameters:**

- `parser`: The parser for the elements
- `sepParser`: The parser for the separator

**Returns:** A parser that produces a non-empty array of parsed elements

**Examples:**

```typescript
const numbers = sepBy1(number, char(','))
numbers.parse("1,2,3") // Success: [1, 2, 3]
numbers.parse("") // Error: Expected at least one element
```

*Defined in [src/combinators.ts:241](src/combinators.ts#L241)*

---

### unknown

**Type:** unknown

Parses one or more occurrences of a parser separated by another parser.Requires at least one match of the main parser.

**Parameters:**

- `parser`: The parser for the elements
- `sepParser`: The parser for the separator

**Returns:** A parser that produces a non-empty array of parsed elements

**Examples:**

```typescript
const numbers = sepBy1(number, char(','))
numbers.parse("1,2,3") // Success: [1, 2, 3]
numbers.parse("") // Error: Expected at least one element
```

*Defined in [src/combinators.ts:241](src/combinators.ts#L241)*

---

### between

**Type:** function

Creates a parser that matches content between two string delimiters.

**Parameters:**

- `start`: The opening delimiter string
- `end`: The closing delimiter string
- `parser`: The parser for the content between delimiters

**Returns:** A parser that matches content between delimiters

**Examples:**

```typescript
const parser = between(char('('), char(')'), digit)
parser.run('(5)') // Right(['5', {...}])
parser.run('5') // Left(error)
parser.run('(5') // Left(error: Expected closing delimiter)
```

*Defined in [src/combinators.ts:267](src/combinators.ts#L267)*

---

### unknown

**Type:** unknown

Creates a parser that matches content between two string delimiters.

**Parameters:**

- `start`: The opening delimiter string
- `end`: The closing delimiter string
- `parser`: The parser for the content between delimiters

**Returns:** A parser that matches content between delimiters

**Examples:**

```typescript
const parser = between(char('('), char(')'), digit)
parser.run('(5)') // Right(['5', {...}])
parser.run('5') // Left(error)
parser.run('(5') // Left(error: Expected closing delimiter)
```

*Defined in [src/combinators.ts:267](src/combinators.ts#L267)*

---

### many_

**Type:** function

Internal helper function for creating repetition parsers.

**Parameters:**

- `count`: Minimum number of repetitions required

**Returns:** A function that creates a parser matching multiple occurrences

*Defined in [src/combinators.ts:295](src/combinators.ts#L295)*

---

### many0

**Type:** variable

Creates a parser that matches zero or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat

**Returns:** A parser that produces an array of all matches

*Defined in [src/combinators.ts:364](src/combinators.ts#L364)*

---

### unknown

**Type:** unknown

Creates a parser that matches zero or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat

**Returns:** A parser that produces an array of all matches

*Defined in [src/combinators.ts:364](src/combinators.ts#L364)*

---

### many

**Type:** variable

Parses zero or more occurrences of a parser (alias for many0).

**Parameters:**

- `parser`: The parser to repeat

**Returns:** A parser that produces an array of parsed elements

*Defined in [src/combinators.ts:373](src/combinators.ts#L373)*

---

### unknown

**Type:** unknown

Parses zero or more occurrences of a parser (alias for many0).

**Parameters:**

- `parser`: The parser to repeat

**Returns:** A parser that produces an array of parsed elements

*Defined in [src/combinators.ts:373](src/combinators.ts#L373)*

---

### many1

**Type:** variable

Creates a parser that matches one or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat

**Returns:** A parser that produces an array of all matches (at least one)

*Defined in [src/combinators.ts:381](src/combinators.ts#L381)*

---

### unknown

**Type:** unknown

Creates a parser that matches one or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat

**Returns:** A parser that produces an array of all matches (at least one)

*Defined in [src/combinators.ts:381](src/combinators.ts#L381)*

---

### manyN

**Type:** variable

Creates a parser that matches at least n occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat
- `n`: Number of required repetitions

**Returns:** A parser that produces an array of at least n matches

*Defined in [src/combinators.ts:391](src/combinators.ts#L391)*

---

### unknown

**Type:** unknown

Creates a parser that matches at least n occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat
- `n`: Number of required repetitions

**Returns:** A parser that produces an array of at least n matches

*Defined in [src/combinators.ts:391](src/combinators.ts#L391)*

---

### manyNExact

**Type:** variable

Creates a parser that matches exactly n occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat
- `n`: Number of required repetitions
- `separator`: Optional parser to match between occurrences

**Returns:** A parser that produces an array of exactly n matches

*Defined in [src/combinators.ts:403](src/combinators.ts#L403)*

---

### unknown

**Type:** unknown

Creates a parser that matches exactly n occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat
- `n`: Number of required repetitions
- `separator`: Optional parser to match between occurrences

**Returns:** A parser that produces an array of exactly n matches

*Defined in [src/combinators.ts:403](src/combinators.ts#L403)*

---

### skipMany_

**Type:** function

Internal helper function for creating skipping repetition parsers.

**Parameters:**

- `count`: Minimum number of repetitions required

**Returns:** A function that creates a parser skipping multiple occurrences

*Defined in [src/combinators.ts:423](src/combinators.ts#L423)*

---

### skipMany0

**Type:** variable

Creates a parser that skips zero or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to skip

**Returns:** A parser that skips all matches

*Defined in [src/combinators.ts:459](src/combinators.ts#L459)*

---

### unknown

**Type:** unknown

Creates a parser that skips zero or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to skip

**Returns:** A parser that skips all matches

*Defined in [src/combinators.ts:459](src/combinators.ts#L459)*

---

### skipMany1

**Type:** variable

Creates a parser that skips one or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to skip

**Returns:** A parser that skips all matches (requires at least one)

*Defined in [src/combinators.ts:467](src/combinators.ts#L467)*

---

### unknown

**Type:** unknown

Creates a parser that skips one or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to skip

**Returns:** A parser that skips all matches (requires at least one)

*Defined in [src/combinators.ts:467](src/combinators.ts#L467)*

---

### skipManyN

**Type:** variable

Creates a parser that skips exactly n occurrences of the input parser.

**Parameters:**

- `parser`: The parser to skip
- `n`: Number of required repetitions to skip

**Returns:** A parser that skips exactly n matches

*Defined in [src/combinators.ts:476](src/combinators.ts#L476)*

---

### unknown

**Type:** unknown

Creates a parser that skips exactly n occurrences of the input parser.

**Parameters:**

- `parser`: The parser to skip
- `n`: Number of required repetitions to skip

**Returns:** A parser that skips exactly n matches

*Defined in [src/combinators.ts:476](src/combinators.ts#L476)*

---

### skipUntil

**Type:** function

Creates a parser that skips input until the given parser succeeds.

**Parameters:**

- `parser`: The parser to look for

**Returns:** A parser that skips input until a match is found

*Defined in [src/combinators.ts:485](src/combinators.ts#L485)*

---

### unknown

**Type:** unknown

Creates a parser that skips input until the given parser succeeds.

**Parameters:**

- `parser`: The parser to look for

**Returns:** A parser that skips input until a match is found

*Defined in [src/combinators.ts:485](src/combinators.ts#L485)*

---

### takeUntil

**Type:** function

Creates a parser that takes input until the given parser succeeds.

**Parameters:**

- `parser`: The parser to look for

**Returns:** A parser that takes input until a match is found

*Defined in [src/combinators.ts:507](src/combinators.ts#L507)*

---

### unknown

**Type:** unknown

Creates a parser that takes input until the given parser succeeds.

**Parameters:**

- `parser`: The parser to look for

**Returns:** A parser that takes input until a match is found

*Defined in [src/combinators.ts:507](src/combinators.ts#L507)*

---

### parseUntilChar

**Type:** function

Creates a parser that takes input until the given character is found.

**Parameters:**

- `char`: The character to look for

**Returns:** A parser that takes input until the character is found

*Defined in [src/combinators.ts:531](src/combinators.ts#L531)*

---

### unknown

**Type:** unknown

Creates a parser that takes input until the given character is found.

**Parameters:**

- `char`: The character to look for

**Returns:** A parser that takes input until the character is found

*Defined in [src/combinators.ts:531](src/combinators.ts#L531)*

---

### skipSpaces

**Type:** variable

A parser that skips any number of space characters.

*Defined in [src/combinators.ts:558](src/combinators.ts#L558)*

---

### unknown

**Type:** unknown

A parser that skips any number of space characters.

*Defined in [src/combinators.ts:558](src/combinators.ts#L558)*

---

### or

**Type:** function

Creates a parser that tries multiple parsers in order until one succeeds.

**Parameters:**

- `parsers`: Array of parsers to try

**Returns:** A parser that succeeds if any of the input parsers succeed

*Defined in [src/combinators.ts:623](src/combinators.ts#L623)*

---

### or

**Type:** function

Creates a parser that tries each of the given parsers in order until one succeeds.This combinator is commit-aware: if any parser sets the  flag duringparsing, no further alternatives will be tried. This enables better error messagesby preventing backtracking once we've identified the intended parse path.

**Parameters:**

- `parsers`: Array of parsers to try in order

**Returns:** A parser that succeeds with the first successful parser's result

**Examples:**

```typescript
// Basic usage - tries each alternative
const value = or(
  numberLiteral,
  stringLiteral,
  booleanLiteral
)
```

```typescript
// With commit for better errors
const statement = or(
  Parser.gen(function* () {
    yield* keyword("if")
    yield* commit()  // No backtracking after this
    yield* char('(').expect("opening parenthesis")
    // ...
  }),
  whileStatement,
  assignment
)

// Input: "if x > 5"  (missing parentheses)
// Without commit: "Expected if, while, or assignment"
// With commit: "Expected opening parenthesis"
```

```typescript
// Error accumulation without commit
const config = or(
  jsonParser.label("JSON format"),
  yamlParser.label("YAML format"),
  tomlParser.label("TOML format")
)
// Errors from all three parsers are accumulated
```

*Defined in [src/combinators.ts:623](src/combinators.ts#L623)*

---

### unknown

**Type:** unknown

Creates a parser that tries multiple parsers in order until one succeeds.

**Parameters:**

- `parsers`: Array of parsers to try

**Returns:** A parser that succeeds if any of the input parsers succeed

*Defined in [src/combinators.ts:623](src/combinators.ts#L623)*

---

### unknown

**Type:** unknown

Creates a parser that tries each of the given parsers in order until one succeeds.This combinator is commit-aware: if any parser sets the  flag duringparsing, no further alternatives will be tried. This enables better error messagesby preventing backtracking once we've identified the intended parse path.

**Parameters:**

- `parsers`: Array of parsers to try in order

**Returns:** A parser that succeeds with the first successful parser's result

**Examples:**

```typescript
// Basic usage - tries each alternative
const value = or(
  numberLiteral,
  stringLiteral,
  booleanLiteral
)
```

```typescript
// With commit for better errors
const statement = or(
  Parser.gen(function* () {
    yield* keyword("if")
    yield* commit()  // No backtracking after this
    yield* char('(').expect("opening parenthesis")
    // ...
  }),
  whileStatement,
  assignment
)

// Input: "if x > 5"  (missing parentheses)
// Without commit: "Expected if, while, or assignment"
// With commit: "Expected opening parenthesis"
```

```typescript
// Error accumulation without commit
const config = or(
  jsonParser.label("JSON format"),
  yamlParser.label("YAML format"),
  tomlParser.label("TOML format")
)
// Errors from all three parsers are accumulated
```

*Defined in [src/combinators.ts:623](src/combinators.ts#L623)*

---

### optional

**Type:** function

Creates a parser that optionally matches the input parser.If the parser fails, returns undefined without consuming input.

**Parameters:**

- `parser`: The parser to make optional

**Returns:** A parser that either succeeds with a value or undefined

*Defined in [src/combinators.ts:657](src/combinators.ts#L657)*

---

### unknown

**Type:** unknown

Creates a parser that optionally matches the input parser.If the parser fails, returns undefined without consuming input.

**Parameters:**

- `parser`: The parser to make optional

**Returns:** A parser that either succeeds with a value or undefined

*Defined in [src/combinators.ts:657](src/combinators.ts#L657)*

---

### choice

**Type:** function

Creates a parser that tries multiple parsers in order and returns the first success.Convenience function for when you have an array of parsers.

**Parameters:**

- `parsers`: Array of parsers to try

**Returns:** A parser that succeeds with the first successful parser's result

**Examples:**

```typescript
const keywords = ["let", "const", "var"].map(k => string(k));
const anyKeyword = choice(keywords);
```

*Defined in [src/combinators.ts:681](src/combinators.ts#L681)*

---

### unknown

**Type:** unknown

Creates a parser that tries multiple parsers in order and returns the first success.Convenience function for when you have an array of parsers.

**Parameters:**

- `parsers`: Array of parsers to try

**Returns:** A parser that succeeds with the first successful parser's result

**Examples:**

```typescript
const keywords = ["let", "const", "var"].map(k => string(k));
const anyKeyword = choice(keywords);
```

*Defined in [src/combinators.ts:681](src/combinators.ts#L681)*

---

### sequence

**Type:** function

Creates a parser that runs multiple parsers in sequence and returns all results.

**Parameters:**

- `parsers`: Array of parsers to run in sequence

**Returns:** A parser that succeeds if all parsers succeed in order, returning a tuple of all results

**Examples:**

```typescript
const parser = sequence([digit, char('-'), digit])
parser.run('1-2') // Right([['1', '-', '2'], {...}])
```

*Defined in [src/combinators.ts:699](src/combinators.ts#L699)*

---

### unknown

**Type:** unknown

Creates a parser that runs multiple parsers in sequence and returns all results.

**Parameters:**

- `parsers`: Array of parsers to run in sequence

**Returns:** A parser that succeeds if all parsers succeed in order, returning a tuple of all results

**Examples:**

```typescript
const parser = sequence([digit, char('-'), digit])
parser.run('1-2') // Right([['1', '-', '2'], {...}])
```

*Defined in [src/combinators.ts:699](src/combinators.ts#L699)*

---

### sequenceLast

**Type:** function

Creates a parser that runs multiple parsers in sequence and returns only the last result.This is the original behavior of sequence for backward compatibility.

**Parameters:**

- `parsers`: Array of parsers to run in sequence

**Returns:** A parser that succeeds if all parsers succeed, returning only the last result

**Examples:**

```typescript
const parser = sequenceLast([string('hello'), char(' '), string('world')])
parser.run('hello world') // Right(['world', {...}])
```

*Defined in [src/combinators.ts:728](src/combinators.ts#L728)*

---

### unknown

**Type:** unknown

Creates a parser that runs multiple parsers in sequence and returns only the last result.This is the original behavior of sequence for backward compatibility.

**Parameters:**

- `parsers`: Array of parsers to run in sequence

**Returns:** A parser that succeeds if all parsers succeed, returning only the last result

**Examples:**

```typescript
const parser = sequenceLast([string('hello'), char(' '), string('world')])
parser.run('hello world') // Right(['world', {...}])
```

*Defined in [src/combinators.ts:728](src/combinators.ts#L728)*

---

### regex

**Type:** variable

Creates a parser that matches input against a regular expression.The regex must match at the start of the input.

**Parameters:**

- `re`: The regular expression to match against

**Returns:** A parser that matches the regex pattern

*Defined in [src/combinators.ts:761](src/combinators.ts#L761)*

---

### unknown

**Type:** unknown

Creates a parser that matches input against a regular expression.The regex must match at the start of the input.

**Parameters:**

- `re`: The regular expression to match against

**Returns:** A parser that matches the regex pattern

*Defined in [src/combinators.ts:761](src/combinators.ts#L761)*

---

### takeUpto

**Type:** function

Creates a parser that takes input until the given parser would succeed, without consuming the parser.

**Parameters:**

- `parser`: The parser to look for

**Returns:** A parser that takes input until before a match would be found

*Defined in [src/combinators.ts:800](src/combinators.ts#L800)*

---

### unknown

**Type:** unknown

Creates a parser that takes input until the given parser would succeed, without consuming the parser.

**Parameters:**

- `parser`: The parser to look for

**Returns:** A parser that takes input until before a match would be found

*Defined in [src/combinators.ts:800](src/combinators.ts#L800)*

---

### commit

**Type:** function

Creates a parser that commits to the current parsing path, preventing backtracking.After calling , if parsing fails later in the sequence, the parser won'tbacktrack to try alternatives in a  or  combinator. This results inmore specific, helpful error messages instead of generic "expected one of" errors.

**Returns:** A parser that sets the commit flag in the parsing context

**Examples:**

```typescript
// Use commit after identifying the type of construct
const ifStatement = Parser.gen(function* () {
  yield* keyword("if")
  yield* commit()  // No backtracking after this point
  yield* char('(').expect("opening parenthesis after 'if'")
  const condition = yield* expression
  yield* char(')').expect("closing parenthesis")
  const body = yield* block
  return { type: "if", condition, body }
})
```

```typescript
// Commit in different parsing contexts
const jsonParser = Parser.gen(function* () {
  const firstChar = yield* peekChar

  if (firstChar === '{') {
    yield* char('{')
    yield* commit()  // Definitely parsing an object
    return yield* jsonObject
  } else if (firstChar === '[') {
    yield* char('[')
    yield* commit()  // Definitely parsing an array
    return yield* jsonArray
  }
  // ...
})
```

```typescript
// Commit with error recovery
const statement = choice([
  ifStatement,    // Has commit() after "if"
  whileStatement, // Has commit() after "while"
  forStatement,   // Has commit() after "for"
  expression      // No commit, can always fall back to this
])

// Input: "if (x > 5 { }"  (missing closing paren)
// Result: "Expected closing parenthesis" (not "Expected if, while, for, or expression")
```

*Defined in [src/combinators.ts:877](src/combinators.ts#L877)*

---

### unknown

**Type:** unknown

Creates a parser that commits to the current parsing path, preventing backtracking.After calling , if parsing fails later in the sequence, the parser won'tbacktrack to try alternatives in a  or  combinator. This results inmore specific, helpful error messages instead of generic "expected one of" errors.

**Returns:** A parser that sets the commit flag in the parsing context

**Examples:**

```typescript
// Use commit after identifying the type of construct
const ifStatement = Parser.gen(function* () {
  yield* keyword("if")
  yield* commit()  // No backtracking after this point
  yield* char('(').expect("opening parenthesis after 'if'")
  const condition = yield* expression
  yield* char(')').expect("closing parenthesis")
  const body = yield* block
  return { type: "if", condition, body }
})
```

```typescript
// Commit in different parsing contexts
const jsonParser = Parser.gen(function* () {
  const firstChar = yield* peekChar

  if (firstChar === '{') {
    yield* char('{')
    yield* commit()  // Definitely parsing an object
    return yield* jsonObject
  } else if (firstChar === '[') {
    yield* char('[')
    yield* commit()  // Definitely parsing an array
    return yield* jsonArray
  }
  // ...
})
```

```typescript
// Commit with error recovery
const statement = choice([
  ifStatement,    // Has commit() after "if"
  whileStatement, // Has commit() after "while"
  forStatement,   // Has commit() after "for"
  expression      // No commit, can always fall back to this
])

// Input: "if (x > 5 { }"  (missing closing paren)
// Result: "Expected closing parenthesis" (not "Expected if, while, for, or expression")
```

*Defined in [src/combinators.ts:877](src/combinators.ts#L877)*

---

### cut

**Type:** variable

Alias for  using Prolog-style naming.The cut operator (!) in Prolog prevents backtracking, similar to howthis prevents the parser from trying other alternatives after this point.

**Examples:**

```typescript
const prologStyleIf = Parser.gen(function* () {
  yield* keyword("if")
  yield* cut()  // Using Prolog-style naming
  yield* char('(')
  // ...
})
```

*Defined in [src/combinators.ts:902](src/combinators.ts#L902)*

---

### unknown

**Type:** unknown

Alias for  using Prolog-style naming.The cut operator (!) in Prolog prevents backtracking, similar to howthis prevents the parser from trying other alternatives after this point.

**Examples:**

```typescript
const prologStyleIf = Parser.gen(function* () {
  yield* keyword("if")
  yield* cut()  // Using Prolog-style naming
  yield* char('(')
  // ...
})
```

*Defined in [src/combinators.ts:902](src/combinators.ts#L902)*

---

### atomic

**Type:** function

Creates an atomic parser that either fully succeeds or resets to the original state.This combinator wraps a parser in a transaction-like behavior. If the parser failsat any point, the input position is reset to where it was before the atomic parserstarted, as if no input was consumed.

**Parameters:**

- `parser`: The parser to make atomic

**Returns:** A new parser with atomic (all-or-nothing) behavior

**Examples:**

```typescript
// Try to parse a complex structure without consuming input on failure
const functionCall = atomic(
  Parser.gen(function* () {
    const name = yield* identifier
    yield* char('(')
    const args = yield* sepBy(expression, char(','))
    yield* char(')')
    return { name, args }
  })
)
```

```typescript
// Use atomic for lookahead without consumption
const nextIsOperator = atomic(
  or(
    string("++"),
    string("--"),
    string("+="),
    string("-=")
  )
).map(() => true).or(Parser.succeed(false))
```

```typescript
// Combine with 'or' for clean alternatives
const value = or(
  atomic(complexExpression),  // Try complex first
  atomic(simpleExpression),   // Then simpler
  literal                     // Finally, just a literal
)

// If complexExpression fails after consuming "foo + ",
// atomic ensures we backtrack completely
```

*Defined in [src/combinators.ts:956](src/combinators.ts#L956)*

---

### unknown

**Type:** unknown

Creates an atomic parser that either fully succeeds or resets to the original state.This combinator wraps a parser in a transaction-like behavior. If the parser failsat any point, the input position is reset to where it was before the atomic parserstarted, as if no input was consumed.

**Parameters:**

- `parser`: The parser to make atomic

**Returns:** A new parser with atomic (all-or-nothing) behavior

**Examples:**

```typescript
// Try to parse a complex structure without consuming input on failure
const functionCall = atomic(
  Parser.gen(function* () {
    const name = yield* identifier
    yield* char('(')
    const args = yield* sepBy(expression, char(','))
    yield* char(')')
    return { name, args }
  })
)
```

```typescript
// Use atomic for lookahead without consumption
const nextIsOperator = atomic(
  or(
    string("++"),
    string("--"),
    string("+="),
    string("-=")
  )
).map(() => true).or(Parser.succeed(false))
```

```typescript
// Combine with 'or' for clean alternatives
const value = or(
  atomic(complexExpression),  // Try complex first
  atomic(simpleExpression),   // Then simpler
  literal                     // Finally, just a literal
)

// If complexExpression fails after consuming "foo + ",
// atomic ensures we backtrack completely
```

*Defined in [src/combinators.ts:956](src/combinators.ts#L956)*

---

### notChar

**Type:** function

Parses any character except the specified one.

**Parameters:**

- `ch`: The character to exclude

**Returns:** A parser that matches any character except the specified one

**Examples:**

```typescript
const notQuote = notChar('"')
notQuote.parse('a') // Success: 'a'
notQuote.parse('"') // Error: Expected any character except '"'
```

*Defined in [src/combinators.ts:973](src/combinators.ts#L973)*

---

### unknown

**Type:** unknown

Parses any character except the specified one.

**Parameters:**

- `ch`: The character to exclude

**Returns:** A parser that matches any character except the specified one

**Examples:**

```typescript
const notQuote = notChar('"')
notQuote.parse('a') // Success: 'a'
notQuote.parse('"') // Error: Expected any character except '"'
```

*Defined in [src/combinators.ts:973](src/combinators.ts#L973)*

---

### eof

**Type:** variable

Parser that succeeds only at the end of input.

**Examples:**

```typescript
const parser = string("hello").then(eof)
parser.parse("hello") // Success
parser.parse("hello world") // Error: Expected end of input
```

*Defined in [src/combinators.ts:1010](src/combinators.ts#L1010)*

---

### unknown

**Type:** unknown

Parser that succeeds only at the end of input.

**Examples:**

```typescript
const parser = string("hello").then(eof)
parser.parse("hello") // Success
parser.parse("hello world") // Error: Expected end of input
```

*Defined in [src/combinators.ts:1010](src/combinators.ts#L1010)*

---

### lookAhead

**Type:** variable

Backward-compatible alias for lookahead.

*Defined in [src/combinators.ts:1028](src/combinators.ts#L1028)*

---

### unknown

**Type:** unknown

Backward-compatible alias for lookahead.

*Defined in [src/combinators.ts:1028](src/combinators.ts#L1028)*

---

### count

**Type:** function

Parses exactly n occurrences of a parser.

**Parameters:**

- `n`: The exact number of occurrences
- `parser`: The parser to repeat

**Returns:** A parser that produces an array of exactly n elements

**Examples:**

```typescript
const threeDigits = count(3, digit)
threeDigits.parse("123") // Success: ['1', '2', '3']
threeDigits.parse("12") // Error: not enough matches
```

*Defined in [src/combinators.ts:1044](src/combinators.ts#L1044)*

---

### unknown

**Type:** unknown

Parses exactly n occurrences of a parser.

**Parameters:**

- `n`: The exact number of occurrences
- `parser`: The parser to repeat

**Returns:** A parser that produces an array of exactly n elements

**Examples:**

```typescript
const threeDigits = count(3, digit)
threeDigits.parse("123") // Success: ['1', '2', '3']
threeDigits.parse("12") // Error: not enough matches
```

*Defined in [src/combinators.ts:1044](src/combinators.ts#L1044)*

---

### sepEndBy

**Type:** function

Parses a list with optional trailing separator.

**Parameters:**

- `parser`: The parser for list elements
- `sep`: The parser for separators

**Returns:** A parser that allows optional trailing separator

**Examples:**

```typescript
const list = sepEndBy(number, char(','))
list.parse("1,2,3") // Success: [1, 2, 3]
list.parse("1,2,3,") // Success: [1, 2, 3] (trailing comma OK)
```

*Defined in [src/combinators.ts:1069](src/combinators.ts#L1069)*

---

### unknown

**Type:** unknown

Parses a list with optional trailing separator.

**Parameters:**

- `parser`: The parser for list elements
- `sep`: The parser for separators

**Returns:** A parser that allows optional trailing separator

**Examples:**

```typescript
const list = sepEndBy(number, char(','))
list.parse("1,2,3") // Success: [1, 2, 3]
list.parse("1,2,3,") // Success: [1, 2, 3] (trailing comma OK)
```

*Defined in [src/combinators.ts:1069](src/combinators.ts#L1069)*

---

