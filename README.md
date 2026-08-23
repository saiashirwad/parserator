# Parserator

Parser combinators for TypeScript, written as generator functions.

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

ESM only. Node 20.19 or newer. No runtime dependencies, and `sideEffects: false`, so it tree-shakes.

Version 0.x, one author. The API can change between minor versions. The test suite is still thin, so if an edge case surprises you, trust the source and file an issue. The examples and benchmarks import TypeScript files directly, so running them needs Node 22.6 or newer.

## What makes it different

Most combinator libraries make you sequence parsers with `.chain()` or `.then()`. That works until you need an `if` in the middle of a rule, and then the code stops looking like the grammar. Inside `parser(function* () { ... })` you get `if`, `while`, and local variables, and TypeScript still infers the result type from `return`.

Errors point at the mistake rather than at wherever the parser gave up. `commit()` marks the place past which a rule will not be abandoned, so `let x 42` reports the missing `=` instead of quietly reading `let` as a variable name. Keyword parsers suggest corrections by edit distance.

The state is a string and an offset, with no line or column to maintain. Those get computed only when someone formats an error, and the failure messages of `char`, `string`, and `regex` are thunks that never get built on branches nobody looks at. On the JSON benchmark it beats Parsimmon by 1.6 to 2.6x.

## Backtracking by default

One choice shapes everything else: parserator always backtracks. When an alternative fails, `or` tries the next one from the offset where the choice began, no matter how much input the failed branch consumed. If you come from Parsec or Parsimmon, this is inverted. There is no `try` or `attempt` here, because you never need one.

The opt-out is `commit()`. Once a branch commits, its failure is final: `or` stops trying alternatives, `many` stops treating it as end of list, `optional` stops treating it as absent. The [errors section](#errors-that-point-at-the-mistake) shows why you want that.

## When not to use it

The whole input is one string in memory, so there is no streaming. A parse stops at the first error it cannot backtrack from; there is no recovery mode that keeps going to report more. Left-recursive grammars loop forever, as in any recursive descent parser. Deep nesting is bounded by the JS call stack: around five thousand levels of recursion throw a `RangeError`. If you need any of those, look elsewhere.

## A tour

### Sequencing

Any `Parser<T>` can be `yield*`ed inside a `parser` block. The yield evaluates to `T`. It must be `yield*`, not a bare `yield`.

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

Three things about the block itself. It re-runs from the top every time the parser runs, which means once per `or` alternative tried and once per `many` iteration, so side effects fire on backtracked paths too. A parse failure is not an exception, so you cannot `catch` it inside the block; recover with `or` or `optional` around the whole parser. And when a parse fails partway through a block, the driver abandons the generator without closing it, so `try/finally` and `using` do not run their cleanup. Keep side effects out of parser blocks.

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

`Parser.lazy` delays construction so a parser can refer to itself; the factory runs once and the result is cached. `or` tries its alternatives in order and takes the first that succeeds.

For repetition there are `many`, `many1`, `manyN`, `sepBy`, `sepBy1`, and `sepEndBy`. Two list semantics hide behind the similar names: `many0`, `many1`, and `manyN` take an optional separator and accept a trailing one, while `sepBy` rejects it. Pick by whether `1, 2, 3,` should parse. A parser that succeeds without consuming input inside any repeater throws a real `Error` rather than looping forever.

`optional(p)` returns `undefined` instead of failing. `sequence` runs a tuple of parsers and returns a tuple. `lookahead(p)` peeks: it returns `p`'s value if `p` matches here and `undefined` if not, consumes nothing, and never fails. `notFollowedBy(p)` is the one that fails, when `p` does match.

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

Without `commit()`, `letExpr` fails at the missing `=`, `or` backtracks to `variable`, and `variable` is happy to read `let` as a name. The parse succeeds with the wrong answer. With `commit()`, the failure inside `letExpr` is final and you get the error above. The same rule applies inside `many` and `optional`: a committed failure is an error, not "end of list" or "not present".

`cut` is an alias of `commit`, for the Prolog-minded. `Parser.fatal(msg)` commits and tags the error as fatal; to the control flow it is `commit()` plus an error nothing softens, and the tag also changes how the error renders.

`.expect(msg)` replaces the error with `Expected <msg>` at the point of failure, so write the message without the word "Expected". `.label(name)` replaces the error with `Expected: <name>`, reported at the start of the labeled parser rather than where it failed, and adds the name to the `Context:` trail in formatted output.

`atomic(p)` clears the commit flag when `p` fails, so a committed or fatal failure inside becomes recoverable at its boundary. That is its whole job: the input position already resets on every backtrack, atomic or not.

Two warnings about the commit flag. First, `.label()` returns the entry state on failure, which silently drops the flag, so `or(letExpr.label("let expression"), variable)` brings back the exact wrong-answer parse shown above. Label the parts inside a committed rule, never the rule you hand to `or`. Second, `or` only honors commits made after it started, so a `commit()` before a choice point turns off commit-awareness for every `or` under it.

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

Suggestions come from Levenshtein distance, two edits or fewer, at most three of them. At distance two, short tokens can draw wrong guesses.

### Getting results out

| Method                  | Returns                                                  |
| ----------------------- | -------------------------------------------------------- |
| `p.parseOrThrow(input)` | `T`, or throws `ParseErrorBundle`                        |
| `p.parseOrError(input)` | `T \| ParseErrorBundle`                                  |
| `p.parse(input)`        | `{ state, result }`, success in `Right`, error in `Left` |

None of these require the parser to reach the end of the input. Add `.thenDiscard(eof)` when the whole string must parse.

One surprise: `ParseErrorBundle` is not an `Error` subclass, and `parseOrThrow` throws it anyway. It has no `.stack`, and `instanceof Error` is false.

`or` collects the errors of the alternatives it tried into the bundle; `.expect` and `.label` throw that collection away and start a fresh one. `.primary` is the error that got furthest into the input; on a tie the first one recorded wins, which follows grammar order and is not always the best message.

`.format()` takes exactly one argument: `"plain"`, `"ansi"`, `"html"`, or `"json"`. To set options, such as context lines (`maxContextLines`, default 3) or hints off (`showHints`), build a `new ErrorFormatter(format, options)` and call its `.format(bundle)`. An options object passed to `.format()` itself is silently ignored.

## Examples

Full parsers live in [`examples/`](examples).

- [`json-parser.ts`](examples/json-parser.ts) is the JSON parser the benchmarks use, and the best first read: a recursive grammar in under a hundred lines.
- [`ini-parser.ts`](examples/ini-parser.ts) parses INI files and wraps each section in `atomic` so a bad section backtracks cleanly.
- [`scheme-parser.ts`](examples/scheme-parser.ts) parses S-expressions with `lambda`, `let`, and `if` as special forms, and uses `Parser.fatal`.
- [`js-parser.ts`](examples/js-parser.ts) handles a JavaScript subset and rejects reserved words as identifiers.
- [`toyml/`](examples/toyml) is an ML-like language with `let rec`, `match`, records, and variants. Its `if`, `match`, and `fun` rules are the best place to see `commit()` in real use. Its operator precedence is a table of `{ ops, assoc }` levels folded over a parser-building function: the textbook technique, and worth reading if you have not seen it done with combinators.

`node examples/main.ts` runs each one against good and bad input and prints the formatted errors.

## Performance

Mean time to parse, Apple Silicon, Node 24, mitata's default warmup and iteration counts.

| Input           | parserator | parsimmon | `JSON.parse` |
| --------------- | ---------: | --------: | -----------: |
| small (~120B)   |      6.3µs |    11.4µs |        229ns |
| medium (~34KB)  |     1.71ms |    3.03ms |       89.8µs |
| large (~1.4MB)  |     77.3ms |   136.2ms |       6.17ms |
| strings (~66KB) |     2.10ms |    3.28ms |       75.4µs |
| numbers (~11KB) |      406µs |    1.04ms |       15.9µs |

The harness checks both parsers against `JSON.parse` output before timing. `JSON.parse` itself is still 12 to 28x faster, which is the price of combinators.

A few rules hold up in the micro benchmarks. For a run of characters, use `regex`, about 80x faster than `many1(digit)` plus a join, or `takeWhileChar1`, about 16x faster. Put the likeliest alternative first in `or`. Build parsers once, outside any loop. A generator block costs about 2.7x more than a `.zip` or `.then` chain for the same rule, so use chains for the tight inner rules and generators for the grammar above them. The suite is in [`bench/`](bench) and runs with `pnpm bench`.

## API

The package exports about 80 names; every one has JSDoc with an example, so editor hover gives the full signature. The ones I reach for most:

- Primitives: `char`, `string`, `regex`, `anyChar`, `oneOfChars`, `anyOfStrings`, `digit`, `alphabet`, `takeWhileChar`, `takeWhileChar1`, `takeUntil`, `takeUpto`, `eof`, `position`
- Combinators: `or`, `optional`, `many`, `many1`, `manyN`, `sepBy`, `sepBy1`, `sepEndBy`, `between`, `sequence`, `count`, `lookahead`, `notFollowedBy`, `commit` (alias `cut`), `atomic`
- Parser methods: `map`, `flatMap`, `zip`, `then`, `thenDiscard`, `trim`, `expect`, `label`, `spanned`, `tap`
- Constructors: `parser(function* () {})`, `Parser.lazy`, `Parser.lift`, `Parser.error`, `Parser.fatal`
- Errors and hints: `ParseErrorBundle`, `ErrorFormatter`, `formatError`, `anyKeywordWithHints`, `keywordWithHints`, `stringWithHints`

Beyond these live skip helpers (`skipSpaces`, `skipMany0`, ...), character-class repeaters (`many1Digit`, ...), debug utilities (`peek*`), and the `State`, `Span`, and `Either` layer you need to write a raw `new Parser(state => ...)`. Browse [`src/index.ts`](src/index.ts) and follow the re-exports.

One deliberate absence: there is no standalone `then` export, because a module member named `then` makes the namespace thenable and breaks `await import()`. Use `zipRight`.

## License

MIT
