# Parserator

Parser combinators for TypeScript, written as generator functions.

Each `yield*` runs a smaller parser and hands back its value. The return type of the function is the type of the parser. No grammar file, no codegen step.

```typescript
import { parser, char, regex } from "parserator"

const number = regex(/-?\d+/).map(Number)

const point = parser(function* () {
  yield* char("(")
  const x = yield* number
  yield* char(",")
  const y = yield* number
  yield* char(")")
  return { x, y }
})

point.parseOrThrow("(10,20)") // { x: 10, y: 20 }
```

## Install

```bash
npm install parserator
```

ESM only. Node 20.19 or newer. No runtime dependencies.

Version 0.x. The API can change between minor versions. The examples and benchmarks import TypeScript files directly, so running them needs Node 22.6 or newer.

## Why I wrote it

Most combinator libraries make you sequence parsers with `.chain()` or `.then()`. That works until you need an `if` in the middle of a rule, and then the code stops looking like the grammar. Generators fix that. Inside `parser(function* () { ... })` you get `if`, `while`, and local variables, and TypeScript still infers the result type from `return`.

The other thing I cared about was error messages. When a user types `let x 42`, a parser that reads `let` as a variable name and carries on has failed them. Parserator has `commit()` for that. Once a branch commits, `or` stops trying the alternatives and the error comes from the place the mistake was made.

It is also fast. The state is a string and an offset. Line and column get computed only when someone formats an error, and error messages on branches that get backtracked over are never built. On the JSON benchmark it beats Parsimmon by 1.6 to 2.7x depending on input.

## When not to use it

The whole input is one string in memory, so there is no streaming. A parse stops at the first error it cannot backtrack from; there is no error recovery that keeps going to report more. Left-recursive grammars loop forever, as in any recursive descent parser. If you need any of those, look elsewhere.

## A tour

### Sequencing

Any `Parser<T>` can be `yield*`ed inside a `parser` block. The yield evaluates to `T`.

```typescript
import { parser, char, regex, Parser } from "parserator"

const ws = regex(/\s*/)
const token = <T>(p: Parser<T>) => p.thenDiscard(ws)
const number = token(regex(/-?\d+/)).map(Number)

const assignment = parser(function* () {
  const name = yield* token(regex(/[a-z]+/))
  yield* token(char("="))
  const value = yield* number
  return { name, value }
})
```

`token` and `number` are reused in the samples below.

Method chains are there when a rule is one line. `.map`, `.flatMap`, `.zip`, `.then`, `.thenDiscard`, and `.trim` all return a new parser.

### Choice, repetition, recursion

```typescript
import { or, sepBy, between, Parser } from "parserator"

const list: Parser<unknown[]> = Parser.lazy(() =>
  between(
    token(char("[")),
    token(char("]")),
    sepBy(or(number, list), token(char(",")))
  )
)

list.parseOrThrow("[1, [2, 3], []]") // [1, [2, 3], []]
```

`Parser.lazy` delays construction so a parser can refer to itself. `or` tries its alternatives in order and takes the first that succeeds. For repetition there are `many`, `many1`, `manyN`, `sepBy`, `sepBy1`, and `sepEndBy`. `optional` returns `undefined` instead of failing. `sequence` runs a tuple of parsers and returns a tuple. `lookahead` and `notFollowedBy` peek without consuming.

### Errors that point at the mistake

```typescript
import { parser, char, regex, or, commit, string } from "parserator"

const name = token(regex(/[a-z]+/))

const letExpr = parser(function* () {
  yield* token(string("let"))
  yield* commit() // past here, don't backtrack into other branches
  const n = yield* name.expect("a variable name")
  yield* token(char("=")).expect("'=' after variable name")
  const value = yield* number.expect("a number")
  return { type: "let", name: n, value }
})

const variable = name.map(n => ({ type: "var", name: n }))

const expr = or(letExpr, variable)
const { result } = expr.parse("let x 42")

if (result._tag === "Left") console.log(result.left.format("plain"))
else console.log(result.right)
```

```
Error at line 1, column 7:
  >   1 | let x 42
                ^
Expected '=' after variable name
```

Now delete the `commit()` line and run it again:

```
{ type: "var", name: "let" }
```

Without `commit()`, `letExpr` fails at the missing `=`, `or` moves on to `variable`, and `variable` is happy to read `let` as a name. The parse succeeds with the wrong answer. With `commit()`, the failure inside `letExpr` is final and you get the error above. The same rule applies inside `many` and `optional`: a committed failure is an error, not "end of list" or "not present".

`.expect(msg)` swaps the error message at the point of failure. `.label(name)` replaces the error with `Expected <name>` at the start of that parser and adds the name to the `Context:` trail in formatted output. `Parser.fatal(msg)` raises an error that `or`, `many`, and `optional` will not backtrack past. `atomic(p)` makes a parser all or nothing. If it fails partway through, the state resets to where it started, and that includes the commit flag, so a committed or fatal failure inside `atomic` becomes recoverable again at its boundary.

Keyword parsers can also suggest a fix:

```typescript
import { anyKeywordWithHints } from "parserator"

const keyword = anyKeywordWithHints(["let", "match", "fun"])
const { result } = keyword.parse("mtch")
if (result._tag === "Left") console.log(result.left.format("plain"))
```

```
Error at line 1, column 1:
  >   1 | mtch
          ^^^^
Unexpected: mtch

  Did you mean: match?
```

Suggestions come from Levenshtein distance, two edits or fewer by default.

### Getting results out

| Method                  | Returns                                                  |
| ----------------------- | -------------------------------------------------------- |
| `p.parseOrThrow(input)` | `T`, or throws `ParseErrorBundle`                        |
| `p.parseOrError(input)` | `T \| ParseErrorBundle`                                  |
| `p.parse(input)`        | `{ state, result }`, success in `Right`, error in `Left` |

None of these require the parser to reach the end of the input. Add `.thenDiscard(eof)` when the whole string must parse.

`ParseErrorBundle` keeps every error the parse produced. `.primary` is the one that got furthest into the input. `.format()` takes `"plain"`, `"ansi"`, `"html"`, or `"json"`. `ErrorFormatter` lets you set how many context lines to print, whether to show hints, and the tab width.

## Examples

Full parsers live in [`examples/`](examples).

- [`json-parser.ts`](examples/json-parser.ts) is the JSON parser the benchmarks use.
- [`ini-parser.ts`](examples/ini-parser.ts) parses INI files and wraps each section in `atomic` so a bad section backtracks cleanly.
- [`scheme-parser.ts`](examples/scheme-parser.ts) parses S-expressions with `lambda`, `let`, and `if` as special forms.
- [`js-parser.ts`](examples/js-parser.ts) handles a JavaScript subset and rejects reserved words as identifiers with `Parser.fatal`.
- [`toyml/`](examples/toyml) is an ML-like language with `let rec`, `match`, records, and variants. Its `if`, `match`, and `fun` rules are the best place to see `commit()` in real use. Its operator precedence table is built by folding a parser-building function over the levels, which is the part of this repo I'd point someone at first.

`node examples/main.ts` runs each one against good and bad input and prints the formatted errors.

## Performance

Median time to parse, Apple Silicon, Node 24.

| Input           | parserator | parsimmon | `JSON.parse` |
| --------------- | ---------: | --------: | -----------: |
| small (~150B)   |      6.2µs |    11.3µs |        219ns |
| medium (~20KB)  |     1.66ms |    3.06ms |       89.4µs |
| large (~350KB)  |     77.0ms |   138.6ms |       6.15ms |
| strings (~60KB) |     2.10ms |    3.33ms |       74.1µs |
| numbers (~16KB) |      383µs |    1.04ms |       15.7µs |

`JSON.parse` is still 12 to 28x faster, which is the price of combinators. Three rules hold up in the micro benchmarks. Use `regex` or `takeWhileChar1` for runs of characters instead of `many1(digit)`, which is about 80x slower. Put the likeliest alternative first in `or`. Build parsers once, outside any loop. One more: a generator block costs about 2.7x more than a `.zip` or `.then` chain for the same rule, so use chains for the tight inner rules and generators for the grammar above them. The suite is in [`bench/`](bench) and runs with `pnpm bench`.

## API at a glance

Primitives: `char`, `string`, `regex`, `anyChar`, `oneOfChars`, `anyOfStrings`, `digit`, `alphabet`, `takeWhileChar`, `takeWhileChar1`, `takeUntil`, `takeUpto`, `eof`, `position`

Combinators: `or`, `optional`, `many`, `many1`, `manyN`, `sepBy`, `sepBy1`, `sepEndBy`, `between`, `sequence`, `count`, `lookahead`, `notFollowedBy`, `zip`, `zipLeft`, `zipRight`, `atomic`, `commit`

Parser methods: `map`, `flatMap`, `zip`, `then`, `thenDiscard`, `trim`, `expect`, `label`, `commit`, `atomic`, `spanned`, `tap`

Constructors: `parser(function* () {})`, `Parser.lazy`, `Parser.lift`, `Parser.error`, `Parser.fatal`

Errors: `ParseErrorBundle`, `ErrorFormatter`, `formatError`

Hints: `anyKeywordWithHints`, `keywordWithHints`, `stringWithHints`, `generateHints`

Every export has JSDoc with an example, so editor hover gives the full signature.

## License

MIT
