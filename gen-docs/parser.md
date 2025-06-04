# parser

## unknown

**Type:** unknown



*Line 20*

---

## unknown

**Type:** unknown



*Line 20*

---

## withError

**Type:** method

Adds an error message to the parser

**Parameters:**

- `makeMessage`: A function that returns an error message

**Returns:** A new parser with the error message added

*Line 85*

---

## unknown

**Type:** unknown

Adds an error message to the parser

**Parameters:**

- `makeMessage`: A function that returns an error message

**Returns:** A new parser with the error message added

*Line 85*

---

## lazy

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

*Line 192*

---

## unknown

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

*Line 192*

---

## tap

**Type:** method

Adds a tap point to observe the current state and result during parsing.Useful for debugging parser behavior.

**Parameters:**

- `callback`: Function called with current state and result

**Returns:** The same parser with the tap point added

*Line 263*

---

## unknown

**Type:** unknown

Adds a tap point to observe the current state and result during parsing.Useful for debugging parser behavior.

**Parameters:**

- `callback`: Function called with current state and result

**Returns:** The same parser with the tap point added

*Line 263*

---

## label

**Type:** method

Adds a label to this parser for better error messages

**Parameters:**

- `name`: The label name to add to the context stack

**Returns:** A new parser with the label added

*Line 314*

---

## unknown

**Type:** unknown

Adds a label to this parser for better error messages

**Parameters:**

- `name`: The label name to add to the context stack

**Returns:** A new parser with the label added

*Line 314*

---

## expect

**Type:** method

Helper for creating semantic expectations with both label and error message

**Parameters:**

- `description`: The description for both the label and error message

**Returns:** A new parser with both labeling and error message

*Line 344*

---

## unknown

**Type:** unknown

Helper for creating semantic expectations with both label and error message

**Parameters:**

- `description`: The description for both the label and error message

**Returns:** A new parser with both labeling and error message

*Line 344*

---

## failRich

**Type:** method

Helper for creating semantic expectations with both label and error message

**Parameters:**

- `errorBundle`: The error bundle containing the errors to be displayed
- `state`: The current parser state

**Returns:** A parser output with the error bundle and the current state

*Line 354*

---

## unknown

**Type:** unknown

Helper for creating semantic expectations with both label and error message

**Parameters:**

- `errorBundle`: The error bundle containing the errors to be displayed
- `state`: The current parser state

**Returns:** A parser output with the error bundle and the current state

*Line 354*

---

## commit

**Type:** method

Commits to the current parsing path, preventing backtracking beyond this point. Once a parser is committed, if it fails later in the sequence, the error won'tbacktrack to try other alternatives in a  or  combinator. This leadsto more specific error messages instead of generic "expected one of" errors.

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

*Line 413*

---

## unknown

**Type:** unknown

Commits to the current parsing path, preventing backtracking beyond this point. Once a parser is committed, if it fails later in the sequence, the error won'tbacktrack to try other alternatives in a  or  combinator. This leadsto more specific error messages instead of generic "expected one of" errors.

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

*Line 413*

---

## atomic

**Type:** method

Creates an atomic parser that either fully succeeds or resets to the original state. This is useful for "all-or-nothing" parsing where you want to try a complexparser but not consume any input if it fails. The parser acts as a transaction -if any part fails, the entire parse is rolled back.

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

*Line 476*

---

## unknown

**Type:** unknown

Creates an atomic parser that either fully succeeds or resets to the original state. This is useful for "all-or-nothing" parsing where you want to try a complexparser but not consume any input if it fails. The parser acts as a transaction -if any part fails, the entire parse is rolled back.

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

*Line 476*

---

