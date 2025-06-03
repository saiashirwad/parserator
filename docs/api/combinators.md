# Combinators API

Combinators are the building blocks of Parserator. They are functions that create parsers or combine existing parsers into new ones. This document covers all the combinators available in Parserator.

## Basic Parsers

### `char(character)`

Creates a parser that matches a single specific character.

```typescript
char<T extends string, Ctx = {}>(ch: T): Parser<T, Ctx>
```

**Parameters:**

- `ch`: The character to match (must be exactly one character)

**Returns:** A parser that matches the specified character

**Example:**

```typescript
const aParser = char("a");
console.log(aParser.parseOrThrow("abc")); // 'a'
console.log(aParser.parse("xyz").result._tag); // 'Left' (failure)
```

### `string(text)`

Creates a parser that matches an exact string.

```typescript
string<Ctx = {}>(str: string): Parser<string, Ctx>
```

**Parameters:**

- `str`: The exact string to match

**Returns:** A parser that matches the specified string

**Example:**

```typescript
const helloParser = string("hello");
console.log(helloParser.parseOrThrow("hello world")); // 'hello'
```

### `narrowedString(text)`

Creates a parser that matches an exact string literal type, preserving the literal type information.

```typescript
narrowedString<const T extends string, Ctx>(str: T): Parser<T, Ctx>
```

**Parameters:**

- `str`: The string literal to match

**Returns:** A parser that matches the string with preserved literal type

**Example:**

```typescript
const helloParser = narrowedString("hello"); // Parser<"hello">
const result: "hello" = helloParser.parseOrThrow("hello");
```

### `regex(pattern)`

Creates a parser that matches a regular expression at the start of the input.

```typescript
regex<Ctx = {}>(re: RegExp): Parser<string, Ctx>
```

**Parameters:**

- `re`: The regular expression to match

**Returns:** A parser that matches the regex pattern

**Example:**

```typescript
const numberParser = regex(/\d+/);
console.log(numberParser.parseOrThrow("123abc")); // '123'

const emailParser = regex(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
console.log(emailParser.parseOrThrow("user@example.com")); // 'user@example.com'
```

### `digit`

A parser that matches any single digit character (0-9).

```typescript
const digit: Parser<string>;
```

**Example:**

```typescript
console.log(digit.parseOrThrow("5abc")); // '5'
console.log(digit.parse("abc").result._tag); // 'Left' (failure)
```

### `alphabet`

A parser that matches any single alphabetic character (a-z, A-Z).

```typescript
const alphabet: Parser<string>;
```

**Example:**

```typescript
console.log(alphabet.parseOrThrow("hello")); // 'h'
console.log(alphabet.parse("123").result._tag); // 'Left' (failure)
```

### `anyChar()`

Creates a parser that matches any single character.

```typescript
anyChar<Ctx = {}>(): Parser<string, Ctx>
```

**Example:**

```typescript
const any = anyChar();
console.log(any.parseOrThrow("x")); // 'x'
console.log(any.parseOrThrow("5")); // '5'
console.log(any.parseOrThrow("!")); // '!'
```

## Choice Combinators

### `or(...parsers)`

Creates a parser that tries multiple parsers in order and returns the result of the first one that succeeds.

```typescript
or<Parsers extends Parser<any, any>[], Ctx = {}>(
  ...parsers: Parsers
): Parser<Parsers[number] extends Parser<infer T, Ctx> ? T : never, Ctx>
```

**Parameters:**

- `parsers`: Array of parsers to try

**Returns:** A parser that succeeds if any of the input parsers succeed

**Example:**

```typescript
const greeting = or(string("hello"), string("hi"), string("hey"));

console.log(greeting.parseOrThrow("hi there")); // 'hi'
console.log(greeting.parseOrThrow("hey you")); // 'hey'
```

### `optional(parser)`

Creates a parser that optionally matches the input parser. Returns `undefined` if the parser fails.

```typescript
optional<T, Ctx = {}>(parser: Parser<T, Ctx>): Parser<T | undefined, Ctx>
```

**Parameters:**

- `parser`: The parser to make optional

**Returns:** A parser that either succeeds with a value or `undefined`

**Example:**

```typescript
const optionalMinus = optional(char("-"));
console.log(optionalMinus.parseOrThrow("123")); // undefined
console.log(optionalMinus.parseOrThrow("-123")); // '-'
```

## Repetition Combinators

### `many0(parser, separator?)`

Creates a parser that matches zero or more occurrences of the input parser.

```typescript
many0<S, T, Ctx = {}>(
  parser: Parser<T, Ctx>,
  separator?: Parser<S, Ctx>
): Parser<T[], Ctx>
```

**Parameters:**

- `parser`: The parser to repeat
- `separator`: Optional separator parser

**Returns:** A parser that produces an array of matched values

**Example:**

```typescript
const digits = many0(digit);
console.log(digits.parseOrThrow("123abc")); // ['1', '2', '3']
console.log(digits.parseOrThrow("abc")); // []

// With separator
const csvNumbers = many0(
  many1(digit).map(d => parseInt(d.join(""))),
  char(",")
);
console.log(csvNumbers.parseOrThrow("1,2,3")); // [1, 2, 3]
```

### `many1(parser, separator?)`

Creates a parser that matches one or more occurrences of the input parser.

```typescript
many1<S, T, Ctx>(
  parser: Parser<T, Ctx>,
  separator?: Parser<S, Ctx>
): Parser<T[], Ctx>
```

**Parameters:**

- `parser`: The parser to repeat
- `separator`: Optional separator parser

**Returns:** A parser that produces an array of at least one matched value

**Example:**

```typescript
const digits = many1(digit);
console.log(digits.parseOrThrow("123abc")); // ['1', '2', '3']
console.log(digits.parse("abc").result._tag); // 'Left' (failure - needs at least one)
```

### `manyN(parser, n, separator?)`

Creates a parser that matches at least n occurrences of the input parser.

```typescript
manyN<S, T, Ctx>(
  parser: Parser<T, Ctx>,
  n: number,
  separator?: Parser<S, Ctx>
): Parser<T[], Ctx>
```

**Parameters:**

- `parser`: The parser to repeat
- `n`: Minimum number of repetitions required
- `separator`: Optional separator parser

**Example:**

```typescript
const atLeastThreeDigits = manyN(digit, 3);
console.log(atLeastThreeDigits.parseOrThrow("12345")); // ['1', '2', '3', '4', '5']
console.log(atLeastThreeDigits.parse("12").result._tag); // 'Left' (failure - needs at least 3)
```

### `manyNExact(parser, n, separator?)`

Creates a parser that matches exactly n occurrences of the input parser.

```typescript
manyNExact<S, T, Ctx>(
  parser: Parser<T, Ctx>,
  n: number,
  separator?: Parser<S, Ctx>
): Parser<T[], Ctx>
```

**Parameters:**

- `parser`: The parser to repeat
- `n`: Exact number of repetitions required
- `separator`: Optional separator parser

**Example:**

```typescript
const exactlyThreeDigits = manyNExact(digit, 3);
console.log(exactlyThreeDigits.parseOrThrow("123abc")); // ['1', '2', '3']
console.log(exactlyThreeDigits.parse("1234").result._tag); // 'Left' (failure - needs exactly 3)
```

### `sepBy(separator, parser)`

Creates a parser that matches zero or more occurrences of elements separated by a separator.

```typescript
sepBy<S, T, Ctx>(
  sepParser: Parser<S, Ctx>,
  parser: Parser<T, Ctx>
): Parser<T[], Ctx>
```

**Parameters:**

- `sepParser`: Parser for the separator
- `parser`: Parser for the elements

**Returns:** A parser that produces an array of matched elements

**Example:**

```typescript
const commaSeparated = sepBy(
  char(","),
  many1(digit).map(d => parseInt(d.join("")))
);
console.log(commaSeparated.parseOrThrow("1,2,3,4")); // [1, 2, 3, 4]
console.log(commaSeparated.parseOrThrow("42")); // [42]
console.log(commaSeparated.parseOrThrow("")); // []
```

## Skip Combinators

### `skipMany0(parser)`

Creates a parser that skips zero or more occurrences of the input parser.

```typescript
skipMany0<T, Ctx = {}>(parser: Parser<T, Ctx>): Parser<undefined, Ctx>
```

**Example:**

```typescript
const skipWhitespace = skipMany0(or(char(" "), char("\t"), char("\n")));
```

### `skipMany1(parser)`

Creates a parser that skips one or more occurrences of the input parser.

```typescript
skipMany1<T, Ctx>(parser: Parser<T, Ctx>): Parser<undefined, Ctx>
```

### `skipManyN(parser, n)`

Creates a parser that skips exactly n occurrences of the input parser.

```typescript
skipManyN<T, Ctx>(parser: Parser<T, Ctx>, n: number): Parser<undefined, Ctx>
```

### `skipSpaces`

A parser that skips any number of space characters.

```typescript
const skipSpaces: Parser<undefined>;
```

**Example:**

```typescript
const trimmedWord = skipSpaces.then(many1(alphabet)).thenDiscard(skipSpaces);
```

## Lookahead Combinators

### `lookAhead(parser)`

Creates a parser that looks ahead in the input without consuming any characters.

```typescript
lookAhead<T, Ctx = {}>(parser: Parser<T, Ctx>): Parser<T | undefined, Ctx>
```

**Parameters:**

- `parser`: The parser to look ahead with

**Returns:** A parser that peeks at the input without consuming it

**Example:**

```typescript
const checkForDigit = lookAhead(digit);
const parser = checkForDigit.then(many1(digit));
console.log(parser.parseOrThrow("123")); // ['1', '2', '3'] (digit is parsed twice)
```

### `notFollowedBy(parser)`

Creates a parser that succeeds only if the given parser fails to match.

```typescript
notFollowedBy<T, Ctx = {}>(parser: Parser<T, Ctx>): Parser<boolean, Ctx>
```

**Parameters:**

- `parser`: The parser that should not match

**Returns:** A parser that succeeds only if the input parser fails

**Example:**

```typescript
const notDigit = notFollowedBy(digit);
const letter = alphabet.thenDiscard(notDigit); // Letter not followed by digit
```

## Sequence Combinators

### `sequence(parsers)`

Creates a parser that runs multiple parsers in sequence and returns the result of the last one.

```typescript
sequence<Parsers extends Parser<any>[], Ctx = {}>(
  parsers: [...Parsers]
): Parser<LastParser<Parsers, Ctx>, Ctx>
```

**Parameters:**

- `parsers`: Array of parsers to run in sequence

**Returns:** A parser that succeeds if all parsers succeed in sequence

**Example:**

```typescript
const abc = sequence([char("a"), char("b"), char("c")]);
console.log(abc.parseOrThrow("abc")); // 'c' (returns last result)
```

### `between(start, end, parser)`

Creates a parser that matches content between two delimiters.

```typescript
between<T, Ctx = {}>(
  start: Parser<any, Ctx>,
  end: Parser<any, Ctx>,
  parser: Parser<T, Ctx>
): Parser<T, Ctx>
```

**Parameters:**

- `start`: Opening delimiter parser
- `end`: Closing delimiter parser
- `parser`: Content parser

**Returns:** A parser that matches content between delimiters

**Example:**

```typescript
const parenthesized = between(char("("), char(")"), many1(digit));
console.log(parenthesized.parseOrThrow("(123)")); // ['1', '2', '3']

const quoted = between(char('"'), char('"'), many0(or(alphabet, digit)));
console.log(quoted.parseOrThrow('"hello123"')); // ['h', 'e', 'l', 'l', 'o', '1', '2', '3']
```

## Text Processing Combinators

### `takeUntil(parser)`

Creates a parser that takes input until the given parser succeeds.

```typescript
takeUntil<T, Ctx = {}>(parser: Parser<T, Ctx>): Parser<string, Ctx>
```

**Parameters:**

- `parser`: The parser to look for as a terminator

**Returns:** A parser that takes input until a match is found

**Example:**

```typescript
const untilComma = takeUntil(char(","));
console.log(untilComma.parseOrThrow("hello,world")); // 'hello'

const untilQuote = takeUntil(char('"'));
console.log(untilQuote.parseOrThrow('say "hello"')); // 'say '
```

### `takeUpto(parser)`

Creates a parser that takes input until the given parser would succeed, without consuming the terminating parser.

```typescript
takeUpto<T>(parser: Parser<T>): Parser<string>
```

**Parameters:**

- `parser`: The parser to look for as a boundary

**Returns:** A parser that takes input until before a match would be found

**Example:**

```typescript
const uptoComma = takeUpto(char(","));
console.log(uptoComma.parseOrThrow("hello,world")); // 'hello' (comma not consumed)
```

### `parseUntilChar(char)`

Creates a parser that takes input until a specific character is found.

```typescript
parseUntilChar<Ctx = {}>(char: string): Parser<string, Ctx>
```

**Parameters:**

- `char`: The character to look for (must be exactly one character)

**Example:**

```typescript
const untilNewline = parseUntilChar("\n");
console.log(untilNewline.parseOrThrow("first line\nsecond line")); // 'first line'
```

### `skipUntil(parser)`

Creates a parser that skips input until the given parser succeeds.

```typescript
skipUntil<T, Ctx = {}>(parser: Parser<T, Ctx>): Parser<undefined, Ctx>
```

**Example:**

```typescript
const skipToQuote = skipUntil(char('"'));
```

## Helper Combinators

### `zip(parserA, parserB)`

Convenience function for combining two parsers into a tuple.

```typescript
zip<A, B>(parserA: Parser<A>, parserB: Parser<B>): Parser<[A, B]>
```

**Example:**

```typescript
const nameAge = zip(stringParser, numberParser);
```

### `then(parserA, parserB)`

Convenience function for sequencing two parsers, returning the second result.

```typescript
then<A, B>(parserA: Parser<A>, parserB: Parser<B>): Parser<B>
```

### `thenDiscard(parserA, parserB)`

Convenience function for sequencing two parsers, returning the first result.

```typescript
thenDiscard<A, B>(parserA: Parser<A>, parserB: Parser<B>): Parser<A>
```

### `zipRight` / `zipLeft`

Aliases for `then` and `thenDiscard` respectively.

```typescript
const zipRight = then;
const zipLeft = thenDiscard;
```

## Advanced Usage Patterns

### Custom Combinators

You can create your own combinators by combining existing ones:

```typescript
// Parse a comma-separated list enclosed in brackets
function bracketList<T>(parser: Parser<T>): Parser<T[]> {
  return between(char("["), char("]"), sepBy(char(","), parser));
}

// Parse whitespace-trimmed content
function lexeme<T>(parser: Parser<T>): Parser<T> {
  return parser.trimRight(skipSpaces);
}

// Parse a keyword (identifier that matches exactly)
function keyword(word: string): Parser<string> {
  return string(word).thenDiscard(notFollowedBy(or(alphabet, digit)));
}
```

### Error-Aware Combinators

Add error handling to your combinators:

```typescript
function expectedList<T>(parser: Parser<T>, itemName: string): Parser<T[]> {
  return bracketList(parser)
    .withError(() => `Expected a list of ${itemName}`)
    .label(`${itemName} list`);
}
```

### Context-Aware Combinators

Create combinators that work with custom context:

```typescript
function debug<T, Ctx extends { debug: boolean }>(
  parser: Parser<T, Ctx>,
  label: string
): Parser<T, Ctx> {
  return parser.tap(({ state, result }) => {
    if (state.context.debug) {
      console.log(`[${label}]`, result);
    }
  });
}
```

## Performance Tips

1. **Reuse parser instances**: Create combinators once and reuse them
2. **Order choices wisely**: Put more likely/longer alternatives first in `or`
3. **Avoid backtracking**: Design grammars that don't require lookahead
4. **Use specific parsers**: `char('a')` is faster than `regex(/a/)`
5. **Handle whitespace explicitly**: Don't rely on automatic whitespace handling

## Common Patterns

### Whitespace-insensitive parsing

```typescript
const ws = regex(/\s*/);
const token = <T>(parser: Parser<T>) => parser.thenDiscard(ws);

const number = token(many1(digit).map(d => parseInt(d.join(""))));
const plus = token(char("+"));
const expr = number.then(plus).then(number);
```

### Recursive structures

```typescript
let expr: Parser<any>;
const atom = or(
  number,
  between(
    char("("),
    char(")"),
    Parser.lazy(() => expr)
  )
);
expr = sepBy1(or(char("+"), char("-")), atom);
```

### Error recovery

```typescript
const robustParser = or(goodParser, takeUntil(char(";")).then(char(";")).then(Parser.pure(null)));
```

## See Also

- [Parser Class API](./parser.md) - The core Parser class methods
- [Error Handling](./error-handling.md) - Advanced error handling techniques
- [Examples](../examples/) - Real-world usage examples
- [Best Practices](../guides/best-practices.md) - Guidelines for effective parser design
