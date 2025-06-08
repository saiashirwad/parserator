# Combinators

## Functions

### lookahead

```typescript
export const lookahead = <T>(par: Parser<T>): Parser<T | undefined> => ...
```

Creates a parser that looks ahead in the input stream without consuming any input. The parser will succeed with the result of the given parser but won't advance the input position.

**Parameters:**

- `par` (`Parser<T>`) - The parser to look ahead with

**Returns:** `Parser<T | undefined>` - A new parser that peeks at the input without consuming it ```ts const parser = lookahead(char('a')) parser.run('abc') // Right(['a', {...}]) // Input position remains at 'abc', 'a' is not consumed ```

### string

```typescript
export const string = (str: string): Parser<string> => ...
```

Creates a parser that matches an exact string in the input.

**Parameters:**

- `str` (`string`) - The string to match

**Returns:** `Parser<string>` - A parser that matches and consumes the exact string ```ts const parser = string("hello") parser.run("hello world") // Right(["hello", {...}]) parser.run("goodbye") // Left(error) ```

### char

```typescript
export const char = <T extends string>(ch: T): Parser<T> => ...
```

Creates a parser that matches a single character.

**Parameters:**

- `ch` (`T`) - The character to match

**Returns:** `Parser<T>` - A parser that matches and consumes a single character ```ts const parser = char("a") parser.run("abc") // Right(["a", {...}]) parser.run("xyz") // Left(error) ```

### alphabet

```typescript
export const alphabet = new Parser(state => ...
```

A parser that matches any single alphabetic character (a-z, A-Z). ```ts const parser = alphabet parser.run("abc") // Right(["a", {...}]) parser.run("123") // Left(error) ```

### digit

```typescript
export const digit = new Parser(state => ...
```

A parser that matches any single digit character (0-9). ```ts const parser = digit parser.run("123") // Right(["1", {...}]) parser.run("abc") // Left(error) ```

### many0

```typescript
export const many0 = <S, T>(parser: Parser<T>, separator?: Parser<S>)
```

Creates a parser that matches zero or more occurrences of the input parser.

**Parameters:**

- `parser` (`Parser<T>`) - The parser to repeat
- `separator?` (`Parser<S>`)

### many

```typescript
export const many = <T>(parser: Parser<T>)
```

Parses zero or more occurrences of a parser (alias for many0).

**Parameters:**

- `parser` (`Parser<T>`) - The parser to repeat

### many1

```typescript
export const many1 = <S, T>(parser: Parser<T>, separator?: Parser<S>)
```

Creates a parser that matches one or more occurrences of the input parser.

**Parameters:**

- `parser` (`Parser<T>`) - The parser to repeat
- `separator?` (`Parser<S>`)

### manyN

```typescript
export const manyN = <S, T>(
  parser: Parser<T>,
  n: number,
  separator?: Parser<S>
)
```

Creates a parser that matches at least n occurrences of the input parser.

**Parameters:**

- `parser` (`Parser<T>`) - The parser to repeat
- `n` (`number`) - Number of required repetitions
- `separator?` (`Parser<S>`)

### manyNExact

```typescript
export const manyNExact = <S, T>(
  par: Parser<T>,
  n: number,
  separator?: Parser<S>
)
```

Creates a parser that matches exactly n occurrences of the input parser.

**Parameters:**

- `par` (`Parser<T>`)
- `n` (`number`) - Number of required repetitions
- `separator?` (`Parser<S>`) - Optional parser to match between occurrences

### skipMany0

```typescript
export const skipMany0 = <T>(parser: Parser<T>)
```

Creates a parser that skips zero or more occurrences of the input parser.

**Parameters:**

- `parser` (`Parser<T>`) - The parser to skip

### skipMany1

```typescript
export const skipMany1 = <T>(parser: Parser<T>)
```

Creates a parser that skips one or more occurrences of the input parser.

**Parameters:**

- `parser` (`Parser<T>`) - The parser to skip

### skipManyN

```typescript
export const skipManyN = <T>(parser: Parser<T>, n: number)
```

Creates a parser that skips exactly n occurrences of the input parser.

**Parameters:**

- `parser` (`Parser<T>`) - The parser to skip
- `n` (`number`) - Number of required repetitions to skip

### parseUntilChar

```typescript
export function parseUntilChar(char: string): Parser<string>
```

Creates a parser that takes input until the given character is found.

**Parameters:**

- `char` (`string`) - The character to look for

**Returns:** `Parser<string>` - A parser that takes input until the character is found

### skipSpaces

```typescript
export const skipSpaces = new Parser(state => ...
```

A parser that skips any number of space characters.

### sequence

```typescript
export const sequence = <const T extends any[]>(
  parsers: T
): Parser<SequenceOutput<T>> => ...
```

Creates a parser that runs multiple parsers in sequence and returns all results.

**Parameters:**

- `parsers` (`T`) - Array of parsers to run in sequence

**Returns:** `Parser<SequenceOutput<T>>` - A parser that succeeds if all parsers succeed in order, returning a tuple of all results

**Examples:**

```typescript
const parser = sequence([digit, char('-'), digit])
parser.run('1-2') // Right([['1', '-', '2'], {...}])
```

### regex

```typescript
export const regex = (re: RegExp): Parser<string> => ...
```

Creates a parser that matches input against a regular expression. The regex must match at the start of the input.

**Parameters:**

- `re` (`RegExp`) - The regular expression to match against

**Returns:** `Parser<string>` - A parser that matches the regex pattern

### commit

```typescript
export function commit(): Parser<void>
```

Creates a parser that commits to the current parsing path, preventing backtracking. After calling `commit()`, if parsing fails later in the sequence, the parser won't backtrack to try alternatives in a `choice` or `or` combinator. This results in more specific, helpful error messages instead of generic "expected one of" errors.

**Returns:** `Parser<void>` - A parser that sets the commit flag in the parsing context

**Examples:**

```typescript
// Use commit after identifying the type of construct
const ifStatement = parser(function* () {
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
const jsonParser = parser(function* () {
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


@see {@link cut} - Alias with Prolog-style naming
```

### cut

```typescript
export const cut = commit;
```

Alias for {@link commit} using Prolog-style naming. The cut operator (!) in Prolog prevents backtracking, similar to how this prevents the parser from trying other alternatives after this point.

**Examples:**

```typescript
const prologStyleIf = parser(function* () {
  yield* keyword("if")
  yield* cut()  // Using Prolog-style naming
  yield* char('(')
  // ...
})
```

### notChar

```typescript
export function notChar(ch: string): Parser<string>
```

Parses any character except the specified one.

**Parameters:**

- `ch` (`string`) - The character to exclude

**Returns:** `Parser<string>` - A parser that matches any character except the specified one

**Examples:**

```typescript
const notQuote = notChar('"')
notQuote.parse('a') // Success: 'a'
notQuote.parse('"') // Error: Expected any character except '"'
```

### eof

```typescript
export const eof = new Parser<void>(state => ...
```

Parser that succeeds only at the end of input.

**Examples:**

```typescript
const parser = string("hello").then(eof)
parser.parse("hello") // Success
parser.parse("hello world") // Error: Expected end of input
```

