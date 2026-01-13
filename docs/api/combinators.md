# Combinators

This page provides a comprehensive reference for the built-in combinators in Parserator. Combinators are higher-order functions that either match primitive input or combine existing parsers into more complex ones.

## Literal Matchers

### char

```typescript
char<T extends string>(ch: T): Parser<T>
```

Matches a single character exactly.

**Example:**

```typescript
const p = char("(");
p.parseOrThrow("("); // "("
```

### string

```typescript
string(str: string): Parser<string>
```

Matches an exact string literal in the input.

**Example:**

```typescript
const p = string("function");
p.parseOrThrow("function"); // "function"
```

### narrowedString

```typescript
narrowedString<const T extends string>(str: T): Parser<T>
```

Similar to `string`, but preserves the literal type in TypeScript's type system.

**Example:**

```typescript
const p = narrowedString("GET"); // Parser<"GET">
```

### regex

```typescript
regex(re: RegExp): Parser<string>
```

Matches the input against a regular expression. The regex must match at the current position (internally uses sticky `y` flag).

**Example:**

```typescript
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/);
```

### digit

```typescript
digit: Parser<string>;
```

Matches any single numeric digit (`0-9`).

**Example:**

```typescript
digit.parseOrThrow("5"); // "5"
```

### alphabet

```typescript
alphabet: Parser<string>;
```

Matches any single alphabetic character (`a-z`, `A-Z`).

**Example:**

```typescript
alphabet.parseOrThrow("a"); // "a"
```

### anyChar

```typescript
anyChar(): Parser<string>
```

Matches and consumes any single character from the input. Fails only at the end of the input.

**Example:**

```typescript
anyChar().parseOrThrow("!"); // "!"
```

### notChar

```typescript
notChar(ch: string): Parser<string>
```

Matches any single character except the one specified.

**Example:**

```typescript
const notQuote = notChar('"');
notQuote.parseOrThrow("a"); // "a"
```

## Repetition

### many

```typescript
many<T>(parser: Parser<T>): Parser<T[]>
```

Matches zero or more occurrences of the given parser. Alias for `many0`.

**Example:**

```typescript
const p = many(char("a"));
p.parseOrThrow("aaa"); // ["a", "a", "a"]
p.parseOrThrow(""); // []
```

### many0

```typescript
many0<S, T>(parser: Parser<T>, separator?: Parser<S>): Parser<T[]>
```

Matches zero or more occurrences of a parser, optionally separated by another parser.

**Example:**

```typescript
const p = many0(digit, char(","));
p.parseOrThrow("1,2,3"); // ["1", "2", "3"]
```

### many1

```typescript
many1<S, T>(parser: Parser<T>, separator?: Parser<S>): Parser<T[]>
```

Matches one or more occurrences of a parser, optionally separated by another parser.

**Example:**

```typescript
const p = many1(digit);
p.parseOrThrow("123"); // ["1", "2", "3"]
```

### manyN

```typescript
manyN<S, T>(parser: Parser<T>, n: number, separator?: Parser<S>): Parser<T[]>
```

Matches at least `n` occurrences of the given parser.

**Example:**

```typescript
const p = manyN(digit, 3);
p.parseOrThrow("1234"); // ["1", "2", "3", "4"]
```

### manyNExact

```typescript
manyNExact<S, T>(par: Parser<T>, n: number, separator?: Parser<S>): Parser<T[]>
```

Matches exactly `n` occurrences of the given parser. Fails with a fatal error if the count doesn't match.

**Example:**

```typescript
const p = manyNExact(digit, 3);
p.parseOrThrow("123"); // ["1", "2", "3"]
```

### count

```typescript
count<T>(n: number, par: Parser<T>): Parser<T[]>
```

Parses exactly `n` occurrences of a parser using a loop.

**Example:**

```typescript
const p = count(2, alphabet);
p.parseOrThrow("ab"); // ["a", "b"]
```

### sepBy

```typescript
sepBy<S, T>(parser: Parser<T>, sepParser: Parser<S>): Parser<T[]>
```

Matches zero or more occurrences of `parser` separated by `sepParser`.

**Example:**

```typescript
const p = sepBy(digit, char(","));
p.parseOrThrow("1,2,3"); // ["1", "2", "3"]
```

### sepBy1

```typescript
sepBy1<S, T>(par: Parser<T>, sepParser: Parser<S>): Parser<T[]>
```

Matches one or more occurrences of `parser` separated by `sepParser`.

**Example:**

```typescript
const p = sepBy1(digit, char(","));
p.parseOrThrow("1"); // ["1"]
```

### sepEndBy

```typescript
sepEndBy<S, T>(par: Parser<T>, sep: Parser<S>): Parser<T[]>
```

Matches zero or more occurrences of `par` separated by `sep`, allowing an optional trailing separator.

**Example:**

```typescript
const p = sepEndBy(digit, char(","));
p.parseOrThrow("1,2,"); // ["1", "2"]
```

## Skip Variants

### skipMany0

```typescript
skipMany0<T>(parser: Parser<T>): Parser<undefined>
```

Skips zero or more occurrences of the input parser. Returns `undefined`.

**Example:**

```typescript
const p = skipMany0(char(" "));
```

### skipMany1

```typescript
skipMany1<T>(parser: Parser<T>): Parser<undefined>
```

Skips one or more occurrences of the input parser.

**Example:**

```typescript
const p = skipMany1(char(" "));
```

### skipManyN

```typescript
skipManyN<T>(parser: Parser<T>, n: number): Parser<undefined>
```

Skips at least `n` occurrences of the input parser.

**Example:**

```typescript
const p = skipManyN(digit, 2);
```

### skipUntil

```typescript
skipUntil<T>(parser: Parser<T>): Parser<undefined>
```

Skips input characters one by one until the given parser succeeds.

**Example:**

```typescript
const p = skipUntil(string("END"));
```

### skipSpaces

```typescript
skipSpaces: Parser<undefined>;
```

Skips any number of space characters (` `).

**Example:**

```typescript
const p = sequence([string("a"), skipSpaces, string("b")]);
```

## Take Variants

### takeUntil

```typescript
takeUntil<T>(parser: Parser<T>): Parser<string>
```

Consumes and returns all input characters until the given parser matches. The matching part is also consumed.

**Example:**

```typescript
const p = takeUntil(string("-->"));
```

### takeUpto

```typescript
takeUpto<T>(parser: Parser<T>): Parser<string>
```

Consumes and returns all input characters until the given parser would match, without consuming the matching part itself.

**Example:**

```typescript
const p = takeUpto(char(")"));
```

### parseUntilChar

```typescript
parseUntilChar(char: string): Parser<string>
```

Consumes and returns all input characters until the specified character is encountered.

**Example:**

```typescript
const p = parseUntilChar("\n");
```

## Alternatives

### or

```typescript
or<Parsers extends Parser<any>[]>(...parsers: Parsers): Parser<T>
```

Tries multiple parsers in order. Returns the result of the first one that succeeds. It is commit-aware: if a parser commits, it won't try further alternatives.

**Example:**

```typescript
const p = or(string("true"), string("false"));
```

### optional

```typescript
optional<T>(parser: Parser<T>): Parser<T | undefined>
```

Tries to match the parser. If it fails, returns `undefined` without consuming any input.

**Example:**

```typescript
const p = optional(char("-"));
```

## Sequencing

### sequence

```typescript
sequence<const T extends any[]>(parsers: T): Parser<SequenceOutput<T>>
```

Runs multiple parsers in sequence and returns an array of all results.

**Example:**

```typescript
const p = sequence([char("("), digit, char(")")]);
```

### zip

```typescript
zip<A, B>(parserA: Parser<A>, parserB: Parser<B>): Parser<[A, B]>
```

Combines two parsers into one that returns a tuple of both results.

**Example:**

```typescript
const p = zip(alphabet, digit);
```

### then

```typescript
then<A, B>(parserA: Parser<A>, parserB: Parser<B>): Parser<B>
```

Runs `parserA` then `parserB`, returning only the result of `parserB`.

**Example:**

```typescript
const p = then(string("0x"), regex(/[0-9a-f]+/));
```

### thenDiscard

```typescript
thenDiscard<A, B>(parserA: Parser<A>, parserB: Parser<B>): Parser<A>
```

Runs `parserA` then `parserB`, returning only the result of `parserA`.

**Example:**

```typescript
const p = thenDiscard(digit, char(";"));
```

### zipRight

```typescript
zipRight: typeof then;
```

Alias for `then`.

### zipLeft

```typescript
zipLeft: typeof thenDiscard;
```

Alias for `thenDiscard`.

## Delimiters

### between

```typescript
between<T>(start: Parser<any>, end: Parser<any>, par: Parser<T>): Parser<T>
```

Matches content `par` surrounded by `start` and `end` parsers.

**Example:**

```typescript
const p = between(char("("), char(")"), digit);
```

## Lookahead

### lookahead

```typescript
lookahead<T>(par: Parser<T>): Parser<T | undefined>
```

Peeks at the input using the given parser without consuming any input.

**Example:**

```typescript
const p = lookahead(string("DEBUG"));
```

### notFollowedBy

```typescript
notFollowedBy<T>(par: Parser<T>): Parser<boolean>
```

Succeeds only if the given parser fails at the current position. Does not consume input.

**Example:**

```typescript
const keywordNotId = then(string("if"), notFollowedBy(alphabet));
```

## Control

### commit

```typescript
commit(): Parser<void>
```

Prevents backtracking for the current alternative in an `or` or `choice` block. Once committed, any subsequent failure will be reported immediately.

**Example:**

```typescript
const p = parser(function* () {
  yield* string("function");
  yield* commit();
  yield* char("(").expect("opening parenthesis");
});
```

### cut

```typescript
cut: typeof commit;
```

Prolog-style alias for `commit`.

### atomic

```typescript
atomic<T>(parser: Parser<T>): Parser<T>
```

Wraps a parser such that if it fails, it resets the input position to where it started, even if it had already consumed input or committed.

**Example:**

```typescript
const p = atomic(sequence([string("abc"), string("def")]));
```

### eof

```typescript
eof: Parser<void>;
```

Succeeds only if the end of the input has been reached.

**Example:**

```typescript
const fullParser = thenDiscard(myParser, eof);
```

### position

```typescript
position: Parser<SourcePosition>;
```

Returns the current source position (line, column, offset) without consuming input.

**Example:**

```typescript
const p = parser(function* () {
  const start = yield* position;
  const content = yield* someParser;
  const end = yield* position;
  return { content, span: { start, end } };
});
```
