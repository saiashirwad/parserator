# Parserator

**Parserator** is a lightweight, generator-friendly parser-combinator toolkit for TypeScript/JavaScript. It pairs a minimal, monadic `Parser<T>` core with a rich set of ready-made combinators, debugging helpers, and human-friendly error reporting. If you are familiar with libraries such as Haskell’s _megaparsec_ or Rust’s _nom_, think of Parserator as their ergonomic TypeScript cousin.

Key features

- ✔️ **Generator syntax** – write top-down parsers that read like imperative code.
- ✔️ **Composable primitives** – build larger grammars from tiny, reusable parts.
- ✔️ **Rich errors & hints** – span-aware bundles, Levenshtein-based suggestions, and multi-format formatters (plain / ANSI / HTML / JSON).
- ✔️ **Batteries included** – character, string, look-ahead, repetition, separators, whitespace-skipping, and more.
- ✔️ **Debugging tools** – live trace, pretty state dumps, breakpoints, and benchmarks.

---

## API reference

> All symbols below are re-exported from the package root (`import { char } from "parserator"`). Types are omitted for brevity; see the generated declaration files for the full generics.

### 1. Chaining helper

| Function                    | Description                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **`chain(parser, ...fns)`** | Thread the result of `parser` through a pipeline of parsers returned by `fns`, short-circuiting on the first error |

---

### 2. Primitive character & string parsers (src/**combinators.ts**)

| Function                     | Matches                                    | Notes                                      |
| ---------------------------- | ------------------------------------------ | ------------------------------------------ |
| **`char(c)`**                | the literal character `c`                  | Yields the matched char.                   |
| **`string(s)`**              | the exact string `s`                       |                                            |
| **`narrowedString(regexp)`** | any string accepted by `regexp`            | Returns _typed_ literal `s` (infer-safe).  |
| **`alphabet`**               | a single ASCII letter (`[a-zA-Z]`)         |                                            |
| **`digit`**                  | a single decimal digit (`[0-9]`)           |                                            |
| **`regex(re)`**              | the first match of regular expression `re` | Handy when no dedicated combinator exists. |
| **`anyChar`**                | any single character                       |                                            |

---

### 3. Combinators

| Function                          | Behaviour                                                       |
| --------------------------------- | --------------------------------------------------------------- |
| **`or(...parsers)`**              | Try each parser left-to-right; succeed with the first match     |
| **`optional(p)`**                 | Succeed with `undefined` when `p` fails without consuming input |
| **`sequence(...parsers)`**        | Run parsers in order, collect results in a tuple                |
| **`between(left, right, inner)`** | Parse `left`, then `inner`, then `right`                        |
| **`sepBy(sep, value)`**           | Zero-or-more `value` separated by `sep`                         |
| **`lookAhead(p)`**                | Peek with `p` but do **not** consume input                      |
| **`skipSpaces`**                  | Skip ASCII spaces and tabs                                      |

#### Repetition helpers

| Function                                                     | Purpose                           |
| ------------------------------------------------------------ | --------------------------------- |
| **`many0(p)`**                                               | Zero or more `p` (array)          |
| **`many1(p)`**                                               | One or more `p`                   |
| **`manyN(n, p)`**                                            | _At least_ `n` repetitions        |
| **`manyNExact(n, p)`**                                       | _Exactly_ `n` repetitions         |
| **`skipMany0(p)`**, **`skipMany1(p)`**, **`skipManyN(n,p)`** | Same as above but discard results |

#### Slice / take helpers

| Function                 | Purpose                                                |
| ------------------------ | ------------------------------------------------------ |
| **`takeUntil(stop)`**    | Consume text until `stop` succeeds                     |
| **`takeUpto(stop)`**     | Same as `takeUntil` but leaves the delimiter untouched |
| **`parseUntilChar(ch)`** | Alias for `takeUntil(char(ch))`                        |

---

### 4. Generator wrapper

| Function                  | Description                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| **`parser(generatorFn)`** | Lift a generator into a `Parser`, giving you `yield*` syntax with automatic state threading. |

---

### 5. Hint & typo support (src/**hints.ts**)

| Function                             | Use                                                      |
| ------------------------------------ | -------------------------------------------------------- |
| **`levenshteinDistance(a,b)`**       | Raw edit distance                                        |
| **`generateHints(found, expected)`** | Pick closest `expected` strings to `found` (≤2 edits)    |
| **`keywordWithHints(list)(kw)`**     | Parse keyword `kw`, suggest nearest alternatives on typo |
| **`anyKeywordWithHints(list)`**      | Accept _any_ keyword from `list` with hints              |
| **`stringWithHints(list)`**          | Parse a quoted string belonging to `list` with hints     |

---

### 6. Error handling utilities

| Function                         | Purpose                                       |
| -------------------------------- | --------------------------------------------- |
| **`createSpan(state, length?)`** | Derive a `Span` from parser state             |
| **`legacyError(bundle)`**        | Adapt new rich errors to legacy `ParserError` |

**Error formatter**

`new ErrorFormatter(fmt = "plain", opts)` → `string`

Multi-format rendering of a `ParseErrorBundle` (`plain`, `ansi`, `html`, `json`) with convenience helpers `formatError.plain/ansi/html/json` .

---

### 7. Debug helpers (src/**debug.ts**)

| Function                                      | Description                                     |
| --------------------------------------------- | ----------------------------------------------- |
| **`debugState(label, state, result, opts?)`** | Pretty-print a single step                      |
| **`debug(parser, label)`**                    | Tap a parser and dump state on every invocation |
| **`trace(label)`**                            | Log current state without consuming input       |
| **`breakpoint(parser, label)`**               | Like `debug`, then drops into `debugger`        |
| **`benchmark(parser, label)`**                | Time a parser run                               |

---

### 8. Low-level error-print helpers (src/**errors.ts**)

| Function                                                                                                        |
| --------------------------------------------------------------------------------------------------------------- |
| `printPosition`, `printArrow`, `printErrorContext`, `printErrorLine`, `printPositionWithOffset`, `getErrorLine` |

---

### 9. Peek utilities (src/**utils.ts**)

| Function        | What it returns                      |
| --------------- | ------------------------------------ |
| `peekState`     | The current `ParserState` unchanged  |
| `peekRemaining` | The remaining input string           |
| `peekAhead(n)`  | The next _n_ characters              |
| `peekLine`      | Rest of the current line             |
| `peekUntil(ch)` | Slice until (but not including) `ch` |
