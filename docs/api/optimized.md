# Optimized Combinators

Performance-optimized versions of common combinators that provide **5-7x speedups** by avoiding regex engines, inlining loops, and minimizing object allocations. These are especially effective when used with `parseFast()`.

## API Reference

### Digit Parsing

#### `manyDigit()`

- **Signature**: `manyDigit(): Parser<string[]>`
- **Description**: Optimized version of `many(digit)`. Uses direct character range checks (`0-9`) in a tight loop.

#### `many1Digit()`

- **Signature**: `many1Digit(): Parser<string[]>`
- **Description**: Optimized version of `many1(digit)`. Requires at least one digit to be present.

### Alphabet Parsing

#### `manyAlphabet()`

- **Signature**: `manyAlphabet(): Parser<string[]>`
- **Description**: Optimized version of `many(alphabet)`. Matches uppercase and lowercase English letters (`a-z`, `A-Z`) using direct character range checks.

#### `many1Alphabet()`

- **Signature**: `many1Alphabet(): Parser<string[]>`
- **Description**: Optimized version of `many1(alphabet)`. Requires at least one letter to be present.

### Alphanumeric Parsing

#### `manyAlphanumeric()`

- **Signature**: `manyAlphanumeric(): Parser<string[]>`
- **Description**: Matches zero or more alphanumeric characters (`a-z`, `A-Z`, `0-9`).

#### `many1Alphanumeric()`

- **Signature**: `many1Alphanumeric(): Parser<string[]>`
- **Description**: Matches one or more alphanumeric characters.

### Character & String Sets

#### `manyChar(ch)`

- **Signature**: `manyChar<T extends string>(ch: T): Parser<T[]>`
- **Description**: Optimized version of `many(char(c))`. Repeatedly matches the same single character.
- **Constraints**: Throws an error if `ch` is not exactly one character long.

#### `oneOfChars(chars)`

- **Signature**: `oneOfChars(chars: string): Parser<string>`
- **Description**: Optimized version of `or(char("a"), char("b"), ...)`. Uses `string.includes()` for O(1) or O(N) lookup depending on engine optimization.

#### `anyOfStrings(...strings)`

- **Signature**: `anyOfStrings(...strings: string[]): Parser<string>`
- **Description**: Optimized version of `or(string("a"), string("b"), ...)`.
- **Behavior**: Automatically sorts input strings by length descending to ensure greedy matching (matches the longest possible string first).

### Whitespace

#### `skipWhitespace()`

- **Signature**: `skipWhitespace(): Parser<void>`
- **Description**: Highly optimized whitespace skip (` `, `\t`, `\n`, `\r`).
- **Optimization**: Zero-allocation. It does not create an array of matched characters, making it ideal for skipping insignificant whitespace.

#### `manyWhitespace()`

- **Signature**: `manyWhitespace(): Parser<string[]>`
- **Description**: Similar to `skipWhitespace()` but returns an array of the matched whitespace characters.

### Predicate-Based Taking

#### `takeWhileChar(predicate)`

- **Signature**: `takeWhileChar(predicate: (ch: string) => boolean): Parser<string>`
- **Description**: Consumes characters as long as the predicate returns `true`. Returns the matched sequence as a single string.

#### `takeUntilChar(predicate)`

- **Signature**: `takeUntilChar(predicate: (ch: string) => boolean): Parser<string>`
- **Description**: Consumes characters until the predicate returns `true`. Equivalent to `takeWhileChar(ch => !predicate(ch))`.

#### `takeN(n)`

- **Signature**: `takeN(n: number): Parser<string>`
- **Description**: Takes exactly `n` characters from the input. Fails if fewer than `n` characters remain.

## Performance Comparison

When running with `parseFast()`, these combinators provide significant improvements over their generic counterparts:

| Regular Pattern                     | Optimized Combinator          | Speedup  |
| :---------------------------------- | :---------------------------- | :------- |
| `many(digit)`                       | `manyDigit()`                 | **7x**   |
| `many1(digit)`                      | `many1Digit()`                | **7x**   |
| `many(alphabet)`                    | `manyAlphabet()`              | **7x**   |
| `many(regex(/[a-zA-Z0-9]/))`        | `manyAlphanumeric()`          | **7x**   |
| `many(regex(/\s/))`                 | `skipWhitespace()`            | **5x**   |
| `or(char("a"), char("b"), ...)`     | `oneOfChars("abc")`           | **1.5x** |
| `or(string("if"), string("while"))` | `anyOfStrings("if", "while")` | **1.5x** |
