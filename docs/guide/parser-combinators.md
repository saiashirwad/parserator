# Combinators

Combinators are functions that take one or more parsers as input and return a new parser as output. They are the building blocks used to compose complex grammars from simple literal matchers.

## Decision Table (Choose a Combinator)

| I want to...             | Use                                 |
| ------------------------ | ----------------------------------- |
| Match exact character    | `char(c)`                           |
| Match exact string       | `string(s)`                         |
| Match regex pattern      | `regex(re)`                         |
| Match any digit          | `digit`                             |
| Match any letter         | `alphabet`                          |
| Match zero or more       | `many(p)`                           |
| Match one or more        | `many1(p)`                          |
| Match exactly N times    | `manyNExact(p, n)` or `count(n, p)` |
| Match at least N times   | `manyN(p, n)`                       |
| Match separated list     | `sepBy(p, sep)`                     |
| Try alternatives         | `or(a, b, c)`                       |
| Make optional            | `optional(p)`                       |
| Match between delimiters | `between(open, close, p)`           |
| Peek without consuming   | `lookahead(p)`                      |
| Fail if matches          | `notFollowedBy(p)`                  |
| Check end of input       | `eof`                               |
| Get current position     | `position`                          |

## Literal Matchers

Literal matchers are the most basic parsers that match specific characters or strings in the input.

```typescript
// Single character
char("("); // Parser<"(">

// Exact string
string("hello"); // Parser<string>

// Regular expression
regex(/[a-z]+/); // Parser<string>

// Built-in character classes
digit; // Parser<string> - matches 0-9
alphabet; // Parser<string> - matches a-z, A-Z
anyChar(); // Parser<string> - matches any single character
```

- `char(c)`: Matches a single character `c`.
- `string(s)`: Matches the exact string `s`.
- `regex(re)`: Matches the regular expression `re` at the current position.
- `digit`: Matches any single digit (0-9).
- `alphabet`: Matches any single alphabetic character (a-z, A-Z).
- `anyChar()`: Matches any single character.

## Repetition

Repetition combinators allow you to match a parser multiple times.

```typescript
// Zero or more
many(digit); // Parser<string[]>

// One or more
many1(digit); // Parser<string[]>

// At least N
manyN(digit, 3); // Parser<string[]> - 3+

// Exactly N
manyNExact(digit, 3); // Parser<string[]> - exactly 3
count(3, digit); // Parser<string[]> - exactly 3 (alternative)

// With separator
sepBy(number, char(",")); // Parser<number[]> - "1,2,3" or ""
sepBy1(number, char(",")); // Parser<number[]> - "1,2,3" (requires at least 1)
sepEndBy(number, char(",")); // Parser<number[]> - "1,2,3" or "1,2,3," (allows trailing)
```

- `many(p)` / `many0(p)`: Matches zero or more occurrences of `p`.
- `many1(p)`: Matches one or more occurrences of `p`.
- `manyN(p, n)`: Matches at least `n` occurrences of `p`.
- `manyNExact(p, n)`: Matches exactly `n` occurrences of `p`.
- `count(n, p)`: Matches exactly `n` occurrences of `p`.
- `sepBy(p, sep)`: Matches zero or more occurrences of `p` separated by `sep`.
- `sepBy1(p, sep)`: Matches one or more occurrences of `p` separated by `sep`.
- `sepEndBy(p, sep)`: Matches zero or more occurrences of `p` separated by `sep`, allowing an optional trailing separator.

## Alternatives

Alternatives allow you to try multiple parsers in order until one succeeds.

```typescript
// Try in order until one succeeds
or(string("true"), string("false"));

// With commit for better errors
const keyword = or(
  parser(function* () {
    yield* string("if");
    yield* commit();
    return "if";
  }),
  parser(function* () {
    yield* string("while");
    yield* commit();
    return "while";
  })
);
```

- `or(...ps)`: Tries each parser in `ps` one by one. If one succeeds, its result is returned. If a parser fails after `commit()`, the whole `or` fails immediately without trying further alternatives.

## Optional

The optional combinator allows a parser to fail without failing the entire parsing process.

```typescript
// Returns T | undefined
optional(char("-"));

// With default value
optional(char("-")).map(sign => sign ?? "+");
```

- `optional(p)`: Tries to match `p`. If it succeeds, returns the result. If it fails (and hasn't committed), returns `undefined` without consuming input.

## Sequencing

Sequencing allows you to run parsers one after another.

```typescript
// Method chaining
string("hello").then(string(" world")); // Parser<string> - keeps " world"
string("hello").thenDiscard(char(" ")); // Parser<string> - keeps "hello"
string("hello").zip(string(" world")); // Parser<[string, string]> - keeps both

// sequence() for multiple
sequence([char("("), number, char(")")]);
// Parser<["(", number, ")"]>
```

- `p1.then(p2)`: Runs `p1` then `p2`, returning the result of `p2`.
- `p1.thenDiscard(p2)`: Runs `p1` then `p2`, returning the result of `p1`.
- `p1.zip(p2)`: Runs `p1` then `p2`, returning both results as a tuple `[R1, R2]`.
- `sequence([p1, p2, ...])`: Runs a list of parsers in order and returns their results as a tuple.

## Delimited Content

Use these to parse content surrounded by other tokens, like parentheses or quotes.

```typescript
// Content between delimiters
between(char("("), char(")"), number);
// Parser<number> - parses "(123)"
```

- `between(open, close, p)`: Runs `open`, then `p`, then `close`. Returns the result of `p`.

## Lookahead

Lookahead allows you to check the future input without consuming it.

```typescript
// Peek without consuming
lookahead(char("("));
// Parser<"(" | undefined>

// Negative lookahead
notFollowedBy(digit);
// Succeeds if next char is NOT a digit
```

- `lookahead(p)`: Tries to match `p`. If it succeeds, returns the result but resets the input position to where it was before `lookahead`.
- `notFollowedBy(p)`: Succeeds if `p` fails to match at the current position. Does not consume input.

## Position and Control

These parsers provide metadata about the parsing state or control the flow of execution.

```typescript
// End of input
eof; // Parser<void> - succeeds only at end

// Get position
position; // Parser<{ offset, line, column }>

// Prevent backtracking
commit(); // Parser<void>
cut(); // Alias for commit()

// All-or-nothing
atomic(p); // Reset to original state on failure
```

- `eof`: Succeeds only if there is no more input to consume.
- `position`: Returns the current source position (offset, line, column).
- `commit()` / `cut()`: Marks the current branch as "committed". If parsing fails after this point, the parser will not backtrack to try other alternatives in an `or()` block.
- `atomic(p)`: Runs `p`. If `p` fails, it resets the input position and committed state to what they were before `atomic`, even if `p` had called `commit()`.

## Take/Skip Variants

These are useful for efficiently consuming parts of the input.

```typescript
// Take until parser matches
takeUntil(char("\n")); // Takes chars until newline (consumes newline)

// Take until before parser matches
takeUpto(string("*/")); // Takes until "*/" found (does NOT consume "*/")

// Skip variants (discard result)
skipMany0(whitespace);
skipMany1(whitespace);
skipUntil(string("END"));
skipSpaces; // Skips ' ' characters
```

- `takeUntil(p)`: Consumes input until `p` matches. Returns the consumed input as a string. `p` is also consumed.
- `takeUpto(p)`: Consumes input until `p` matches. Returns the consumed input as a string. `p` is NOT consumed.
- `skipMany0(p)` / `skipMany1(p)`: Matches zero/one or more occurrences of `p` and discards the result.
- `skipUntil(p)`: Consumes and discards input until `p` matches.
- `skipSpaces`: Discards any number of space characters (' ').
- `parseUntilChar(c)`: Consumes input until character `c` is found.
- `notChar(c)`: Matches any single character except `c`.
