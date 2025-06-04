# combinators

## lookahead

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

*Line 18*

---

## unknown

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

*Line 18*

---

## notFollowedBy

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

*Line 40*

---

## unknown

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

*Line 40*

---

## string

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

*Line 68*

---

## unknown

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

*Line 68*

---

## narrowedString

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

*Line 97*

---

## unknown

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

*Line 97*

---

## char

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

*Line 112*

---

## unknown

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

*Line 112*

---

## alphabet

**Type:** variable

A parser that matches any single alphabetic character (a-z, A-Z).

**Examples:**

```typescript
const parser = alphabet
parser.run("abc") // Right(["a", {...}])
parser.run("123") // Left(error)
```

*Line 138*

---

## unknown

**Type:** unknown

A parser that matches any single alphabetic character (a-z, A-Z).

**Examples:**

```typescript
const parser = alphabet
parser.run("abc") // Right(["a", {...}])
parser.run("123") // Left(error)
```

*Line 138*

---

## digit

**Type:** variable

A parser that matches any single digit character (0-9).

**Examples:**

```typescript
const parser = digit
parser.run("123") // Right(["1", {...}])
parser.run("abc") // Left(error)
```

*Line 162*

---

## unknown

**Type:** unknown

A parser that matches any single digit character (0-9).

**Examples:**

```typescript
const parser = digit
parser.run("123") // Right(["1", {...}])
parser.run("abc") // Left(error)
```

*Line 162*

---

## sepBy

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

*Line 191*

---

## unknown

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

*Line 191*

---

## sepBy1

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

*Line 241*

---

## unknown

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

*Line 241*

---

## between

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

*Line 267*

---

## unknown

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

*Line 267*

---

## many_

**Type:** function

Internal helper function for creating repetition parsers.

**Parameters:**

- `count`: Minimum number of repetitions required

**Returns:** A function that creates a parser matching multiple occurrences

*Line 295*

---

## many0

**Type:** variable

Creates a parser that matches zero or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat

**Returns:** A parser that produces an array of all matches

*Line 364*

---

## unknown

**Type:** unknown

Creates a parser that matches zero or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat

**Returns:** A parser that produces an array of all matches

*Line 364*

---

## many

**Type:** variable

Parses zero or more occurrences of a parser (alias for many0).

**Parameters:**

- `parser`: The parser to repeat

**Returns:** A parser that produces an array of parsed elements

*Line 373*

---

## unknown

**Type:** unknown

Parses zero or more occurrences of a parser (alias for many0).

**Parameters:**

- `parser`: The parser to repeat

**Returns:** A parser that produces an array of parsed elements

*Line 373*

---

## many1

**Type:** variable

Creates a parser that matches one or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat

**Returns:** A parser that produces an array of all matches (at least one)

*Line 381*

---

## unknown

**Type:** unknown

Creates a parser that matches one or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat

**Returns:** A parser that produces an array of all matches (at least one)

*Line 381*

---

## manyN

**Type:** variable

Creates a parser that matches at least n occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat
- `n`: Number of required repetitions

**Returns:** A parser that produces an array of at least n matches

*Line 391*

---

## unknown

**Type:** unknown

Creates a parser that matches at least n occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat
- `n`: Number of required repetitions

**Returns:** A parser that produces an array of at least n matches

*Line 391*

---

## manyNExact

**Type:** variable

Creates a parser that matches exactly n occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat
- `n`: Number of required repetitions
- `separator`: Optional parser to match between occurrences

**Returns:** A parser that produces an array of exactly n matches

*Line 403*

---

## unknown

**Type:** unknown

Creates a parser that matches exactly n occurrences of the input parser.

**Parameters:**

- `parser`: The parser to repeat
- `n`: Number of required repetitions
- `separator`: Optional parser to match between occurrences

**Returns:** A parser that produces an array of exactly n matches

*Line 403*

---

## skipMany_

**Type:** function

Internal helper function for creating skipping repetition parsers.

**Parameters:**

- `count`: Minimum number of repetitions required

**Returns:** A function that creates a parser skipping multiple occurrences

*Line 423*

---

## skipMany0

**Type:** variable

Creates a parser that skips zero or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to skip

**Returns:** A parser that skips all matches

*Line 459*

---

## unknown

**Type:** unknown

Creates a parser that skips zero or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to skip

**Returns:** A parser that skips all matches

*Line 459*

---

## skipMany1

**Type:** variable

Creates a parser that skips one or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to skip

**Returns:** A parser that skips all matches (requires at least one)

*Line 467*

---

## unknown

**Type:** unknown

Creates a parser that skips one or more occurrences of the input parser.

**Parameters:**

- `parser`: The parser to skip

**Returns:** A parser that skips all matches (requires at least one)

*Line 467*

---

## skipManyN

**Type:** variable

Creates a parser that skips exactly n occurrences of the input parser.

**Parameters:**

- `parser`: The parser to skip
- `n`: Number of required repetitions to skip

**Returns:** A parser that skips exactly n matches

*Line 476*

---

## unknown

**Type:** unknown

Creates a parser that skips exactly n occurrences of the input parser.

**Parameters:**

- `parser`: The parser to skip
- `n`: Number of required repetitions to skip

**Returns:** A parser that skips exactly n matches

*Line 476*

---

## skipUntil

**Type:** function

Creates a parser that skips input until the given parser succeeds.

**Parameters:**

- `parser`: The parser to look for

**Returns:** A parser that skips input until a match is found

*Line 485*

---

## unknown

**Type:** unknown

Creates a parser that skips input until the given parser succeeds.

**Parameters:**

- `parser`: The parser to look for

**Returns:** A parser that skips input until a match is found

*Line 485*

---

## takeUntil

**Type:** function

Creates a parser that takes input until the given parser succeeds.

**Parameters:**

- `parser`: The parser to look for

**Returns:** A parser that takes input until a match is found

*Line 507*

---

## unknown

**Type:** unknown

Creates a parser that takes input until the given parser succeeds.

**Parameters:**

- `parser`: The parser to look for

**Returns:** A parser that takes input until a match is found

*Line 507*

---

## parseUntilChar

**Type:** function

Creates a parser that takes input until the given character is found.

**Parameters:**

- `char`: The character to look for

**Returns:** A parser that takes input until the character is found

*Line 531*

---

## unknown

**Type:** unknown

Creates a parser that takes input until the given character is found.

**Parameters:**

- `char`: The character to look for

**Returns:** A parser that takes input until the character is found

*Line 531*

---

## skipSpaces

**Type:** variable

A parser that skips any number of space characters.

*Line 558*

---

## unknown

**Type:** unknown

A parser that skips any number of space characters.

*Line 558*

---

## or

**Type:** function

Creates a parser that tries multiple parsers in order until one succeeds.

**Parameters:**

- `parsers`: Array of parsers to try

**Returns:** A parser that succeeds if any of the input parsers succeed

*Line 623*

---

## or

**Type:** function

Creates a parser that tries each of the given parsers in order until one succeeds. This combinator is commit-aware: if any parser sets the  flag duringparsing, no further alternatives will be tried. This enables better error messagesby preventing backtracking once we've identified the intended parse path.

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

*Line 623*

---

## unknown

**Type:** unknown

Creates a parser that tries multiple parsers in order until one succeeds.

**Parameters:**

- `parsers`: Array of parsers to try

**Returns:** A parser that succeeds if any of the input parsers succeed

*Line 623*

---

## unknown

**Type:** unknown

Creates a parser that tries each of the given parsers in order until one succeeds. This combinator is commit-aware: if any parser sets the  flag duringparsing, no further alternatives will be tried. This enables better error messagesby preventing backtracking once we've identified the intended parse path.

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

*Line 623*

---

## optional

**Type:** function

Creates a parser that optionally matches the input parser.If the parser fails, returns undefined without consuming input.

**Parameters:**

- `parser`: The parser to make optional

**Returns:** A parser that either succeeds with a value or undefined

*Line 657*

---

## unknown

**Type:** unknown

Creates a parser that optionally matches the input parser.If the parser fails, returns undefined without consuming input.

**Parameters:**

- `parser`: The parser to make optional

**Returns:** A parser that either succeeds with a value or undefined

*Line 657*

---

## choice

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

*Line 681*

---

## unknown

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

*Line 681*

---

## sequence

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

*Line 699*

---

## unknown

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

*Line 699*

---

## sequenceLast

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

*Line 728*

---

## unknown

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

*Line 728*

---

## regex

**Type:** variable

Creates a parser that matches input against a regular expression.The regex must match at the start of the input.

**Parameters:**

- `re`: The regular expression to match against

**Returns:** A parser that matches the regex pattern

*Line 761*

---

## unknown

**Type:** unknown

Creates a parser that matches input against a regular expression.The regex must match at the start of the input.

**Parameters:**

- `re`: The regular expression to match against

**Returns:** A parser that matches the regex pattern

*Line 761*

---

## takeUpto

**Type:** function

Creates a parser that takes input until the given parser would succeed, without consuming the parser.

**Parameters:**

- `parser`: The parser to look for

**Returns:** A parser that takes input until before a match would be found

*Line 800*

---

## unknown

**Type:** unknown

Creates a parser that takes input until the given parser would succeed, without consuming the parser.

**Parameters:**

- `parser`: The parser to look for

**Returns:** A parser that takes input until before a match would be found

*Line 800*

---

## commit

**Type:** function

Creates a parser that commits to the current parsing path, preventing backtracking. After calling , if parsing fails later in the sequence, the parser won'tbacktrack to try alternatives in a  or  combinator. This results inmore specific, helpful error messages instead of generic "expected one of" errors.

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

*Line 877*

---

## unknown

**Type:** unknown

Creates a parser that commits to the current parsing path, preventing backtracking. After calling , if parsing fails later in the sequence, the parser won'tbacktrack to try alternatives in a  or  combinator. This results inmore specific, helpful error messages instead of generic "expected one of" errors.

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

*Line 877*

---

## cut

**Type:** variable

Alias for  using Prolog-style naming. The cut operator (!) in Prolog prevents backtracking, similar to howthis prevents the parser from trying other alternatives after this point.

**Examples:**

```typescript
const prologStyleIf = Parser.gen(function* () {
  yield* keyword("if")
  yield* cut()  // Using Prolog-style naming
  yield* char('(')
  // ...
})
```

*Line 902*

---

## unknown

**Type:** unknown

Alias for  using Prolog-style naming. The cut operator (!) in Prolog prevents backtracking, similar to howthis prevents the parser from trying other alternatives after this point.

**Examples:**

```typescript
const prologStyleIf = Parser.gen(function* () {
  yield* keyword("if")
  yield* cut()  // Using Prolog-style naming
  yield* char('(')
  // ...
})
```

*Line 902*

---

## atomic

**Type:** function

Creates an atomic parser that either fully succeeds or resets to the original state. This combinator wraps a parser in a transaction-like behavior. If the parser failsat any point, the input position is reset to where it was before the atomic parserstarted, as if no input was consumed.

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

*Line 956*

---

## unknown

**Type:** unknown

Creates an atomic parser that either fully succeeds or resets to the original state. This combinator wraps a parser in a transaction-like behavior. If the parser failsat any point, the input position is reset to where it was before the atomic parserstarted, as if no input was consumed.

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

*Line 956*

---

## notChar

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

*Line 973*

---

## unknown

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

*Line 973*

---

## eof

**Type:** variable

Parser that succeeds only at the end of input.

**Examples:**

```typescript
const parser = string("hello").then(eof)
parser.parse("hello") // Success
parser.parse("hello world") // Error: Expected end of input
```

*Line 1010*

---

## unknown

**Type:** unknown

Parser that succeeds only at the end of input.

**Examples:**

```typescript
const parser = string("hello").then(eof)
parser.parse("hello") // Success
parser.parse("hello world") // Error: Expected end of input
```

*Line 1010*

---

## lookAhead

**Type:** variable

Backward-compatible alias for lookahead.

*Line 1028*

---

## unknown

**Type:** unknown

Backward-compatible alias for lookahead.

*Line 1028*

---

## count

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

*Line 1044*

---

## unknown

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

*Line 1044*

---

## sepEndBy

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

*Line 1069*

---

## unknown

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

*Line 1069*

---

