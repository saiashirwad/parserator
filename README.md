# Parserator

Parser combinators for TypeScript, written to be read.

You build a parser out of small functions and compose them with plain TypeScript. No grammar files, no codegen, no build step. Generator syntax makes a parser look like the grammar it implements, and the types follow along.

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

ESM only. Node 20.19 or newer. Zero runtime dependencies.

## Why

- **Generators, not method chains.** Sequencing is `yield*`, so you can use `if`, `while`, and local variables inside a parser. The result type is inferred from `return`.
- **Errors a person can read.** Every failure carries a span. Formatting gives you the offending line, a caret, the expected item, and a breadcrumb of labels. Output as plain text, ANSI, HTML, or JSON.
- **Commit and backtrack on your terms.** `commit()` stops `or` from trying the next branch once you know where you are. You get "Expected '=' after variable name" instead of "Expected 'let' or number".
- **"Did you mean?"** Keyword parsers suggest near misses by edit distance.
- **Fast.** Line and column are computed lazily, error messages are built only when read, and the hot path allocates little. On a JSON benchmark it runs 1.4–2.7x faster than Parsimmon.

## A tour

### Sequencing

Any `Parser<T>` can be `yield*`ed inside `parser(function* () { ... })`. The yield evaluates to `T`.

```typescript
const ws = regex(/\s*/)
const token = <T>(p: Parser<T>) => p.thenDiscard(ws)

const assignment = parser(function* () {
  const name = yield* token(regex(/[a-z]+/))
  yield* token(char("="))
  const value = yield* token(number)
  return { name, value }
})
```

Method chains work too when they read better: `.map`, `.flatMap`, `.zip`, `.then`, `.thenDiscard`, `.trim`.

### Choice, repetition, recursion

```typescript
import { or, many, sepBy, between, Parser } from "parserator"

const list: Parser<unknown[]> = Parser.lazy(() =>
  between(
    token(char("[")),
    token(char("]")),
    sepBy(or(number, list), token(char(",")))
  )
)

list.parseOrThrow("[1, [2, 3], []]") // [1, [2, 3], []]
```

`Parser.lazy` defers construction so a parser can refer to itself. `or` tries alternatives in order. `sepBy`, `sepBy1`, `sepEndBy`, `many`, `many1`, `optional`, `sequence`, `lookahead`, and `notFollowedBy` cover the rest.

### Errors that point at the problem

```typescript
import { commit, string } from "parserator"

const letExpr = parser(function* () {
  yield* token(string("let"))
  yield* commit() // past here, don't backtrack into other branches
  const name = yield* token(regex(/[a-z]+/)).expect("a variable name")
  yield* token(char("=")).expect("'=' after variable name")
  const value = yield* number.expect("a number")
  return { name, value }
})

const stmt = or(letExpr, number)
const { result } = stmt.parse("let x 42")

if (result._tag === "Left") console.log(result.left.format("plain"))
```

```
Error at line 1, column 7:
  >   1 | let x 42
                  ^
Expected '=' after variable name
```

Without `commit()`, `or` would fall through to `number` and report a failure at column 1. With it, the error comes from inside `letExpr` where the real mistake is.

`.expect(msg)` replaces the error message at the point of failure. `.label(name)` names a whole parser and adds it to the `Context:` trail. `atomic(p)` makes a parser all-or-nothing: on failure it resets to where it started, including the commit flag. `Parser.fatal(msg)` raises an error that nothing can backtrack past.

### Typo suggestions

```typescript
import { anyKeywordWithHints } from "parserator"

const keyword = anyKeywordWithHints(["let", "match", "fun"])
keyword.parse("mtch")
```

```
Error at line 1, column 1:
  >   1 | mtch
            ^^^^
Unexpected: mtch

  Did you mean: match?
```

`keywordWithHints`, `stringWithHints`, and the raw `generateHints` / `levenshteinDistance` are there when you want to build your own.

### Getting results out

| Method                  | Returns                                          |
| ----------------------- | ------------------------------------------------ |
| `p.parseOrThrow(input)` | `T`, or throws `ParseErrorBundle`                |
| `p.parseOrError(input)` | `T \| ParseErrorBundle`                          |
| `p.parse(input)`        | `{ state, result: Either<T, ParseErrorBundle> }` |

`ParseErrorBundle` holds every error collected. `.primary` is the one that got furthest into the input. `.format("plain" | "ansi" | "html" | "json")` renders it; `ErrorFormatter` gives you control over context lines, hints, and tab width.

## Examples

Full parsers live in [`examples/`](examples):

- [`json-parser.ts`](examples/json-parser.ts) — JSON, the one used in the benchmarks
- [`ini-parser.ts`](examples/ini-parser.ts) — INI files, with `atomic` and `commit` for precise errors
- [`scheme-parser.ts`](examples/scheme-parser.ts) — an S-expression language with special forms
- [`js-parser.ts`](examples/js-parser.ts) — a JavaScript subset with reserved-word checks
- [`toyml/`](examples/toyml) — an ML-like language: `let rec`, `match`, records, variants, and precedence climbing built by composing parsers

Run them all against good and bad input with `node examples/main.ts`.

## Performance

The hot path does as little as it can. Parser state is `{ source, offset }` plus two optional flags, so advancing costs nothing. Spans compute line and column only when an error is displayed. Error messages on branches that get backtracked over are never built.

Median time to parse, Apple Silicon, Node 24:

| Input          | parserator | parsimmon | `JSON.parse` |
| -------------- | ---------: | --------: | -----------: |
| small (~150B)  |      6.2µs |    11.3µs |        219ns |
| medium (~20KB) |     1.66ms |    3.06ms |       89.4µs |
| large (~350KB) |     77.0ms |   138.6ms |       6.15ms |

A few rules hold up under the micro benchmarks: prefer `regex` or `takeWhileChar` over `many1(digit)` for runs of characters, order `or` alternatives by likelihood, and hoist parsers out of loops. See [`bench/`](bench) for the suite and `pnpm bench` to run it.

## API at a glance

**Primitives** — `char`, `string`, `regex`, `anyChar`, `oneOfChars`, `anyOfStrings`, `digit`, `alphabet`, `takeWhileChar`, `takeUntil`, `takeUpto`, `eof`, `position`

**Combinators** — `or`, `optional`, `many`, `many1`, `manyN`, `sepBy`, `sepBy1`, `sepEndBy`, `between`, `sequence`, `count`, `lookahead`, `notFollowedBy`, `zip`, `zipLeft`, `zipRight`, `atomic`, `commit`

**Parser methods** — `map`, `flatMap`, `zip`, `then`, `thenDiscard`, `trim`, `expect`, `label`, `commit`, `atomic`, `spanned`, `tap`

**Constructors** — `parser(function* () {})`, `Parser.lazy`, `Parser.lift`, `Parser.error`, `Parser.fatal`

**Errors** — `ParseErrorBundle`, `ErrorFormatter`, `formatError`

**Hints** — `anyKeywordWithHints`, `keywordWithHints`, `stringWithHints`, `generateHints`

## License

MIT
