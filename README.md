# Parserator

Parser combinators for TypeScript.

You write a parser as a generator function. Each `yield*` runs a smaller parser and hands back its value. The return type of the function is the type of the parser. No grammar file, no codegen step.

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

## Why I wrote it

Most combinator libraries make you sequence parsers with `.chain()` or `.then()`. That works until you need an `if` in the middle of a rule, and then the code stops looking like the grammar. Generators fix that. Inside `parser(function* () { ... })` you get `if`, `while`, and local variables, and TypeScript still infers the result type from `return`.

The other thing I cared about was error messages. A parser that says "expected 'let' or number at column 1" when the user forgot an `=` on column 7 is useless. Parserator has `commit()` for that. Once a branch commits, `or` stops trying the alternatives and the error comes from the place the mistake was made.

It is also fast. The state is a string and an offset. Line and column get computed only when someone formats an error, and error messages on branches that get backtracked over are never built. On the JSON benchmark it beats Parsimmon by 1.4 to 2.7x depending on input.

## A tour

### Sequencing

Any `Parser<T>` can be `yield*`ed inside a `parser` block. The yield evaluates to `T`.

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

Method chains still exist for the cases where they read better. `.map`, `.flatMap`, `.zip`, `.then`, `.thenDiscard`, and `.trim` are all there.

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

`Parser.lazy` delays construction so a parser can refer to itself. `or` tries its alternatives in order and takes the first that succeeds. For repetition there are `many`, `many1`, `manyN`, `sepBy`, `sepBy1`, and `sepEndBy`. `optional`, `sequence`, `lookahead`, and `notFollowedBy` cover the rest.

### Errors that point at the mistake

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

Take out the `commit()` and `or` falls through to `number`, which fails at column 1 with a message about digits. That is the wrong error. The user typed `let`, so they meant a let binding, and the parser should hold them to it.

`.expect(msg)` swaps the error message at the point of failure. `.label(name)` names a whole parser and adds it to the `Context:` trail in formatted output. `atomic(p)` makes a parser all or nothing. If it fails partway through, the state resets to where it started, commit flag included. `Parser.fatal(msg)` raises an error that nothing can backtrack past.

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

Suggestions come from Levenshtein distance, two edits or fewer by default. `keywordWithHints` and `stringWithHints` do the same for single keywords and quoted strings. `generateHints` and `levenshteinDistance` are exported if you want to wire it up yourself.

### Getting results out

| Method                  | Returns                                          |
| ----------------------- | ------------------------------------------------ |
| `p.parseOrThrow(input)` | `T`, or throws `ParseErrorBundle`                |
| `p.parseOrError(input)` | `T \| ParseErrorBundle`                          |
| `p.parse(input)`        | `{ state, result: Either<T, ParseErrorBundle> }` |

`ParseErrorBundle` keeps every error the parse produced. `.primary` is the one that got furthest into the input, which is almost always the one you want to show. `.format()` takes `"plain"`, `"ansi"`, `"html"`, or `"json"`. `ErrorFormatter` lets you set how many context lines to print, whether to show hints, and the tab width.

## Examples

Full parsers live in [`examples/`](examples).

- [`json-parser.ts`](examples/json-parser.ts) is the JSON parser the benchmarks use.
- [`ini-parser.ts`](examples/ini-parser.ts) parses INI files and shows `atomic` and `commit` working together.
- [`scheme-parser.ts`](examples/scheme-parser.ts) parses S-expressions with `lambda`, `let`, and `if` as special forms.
- [`js-parser.ts`](examples/js-parser.ts) handles a JavaScript subset and rejects reserved words as identifiers with `Parser.fatal`.
- [`toyml/`](examples/toyml) is an ML-like language with `let rec`, `match`, records, and variants. Its operator precedence table is built by folding a parser-building function over the levels, which is the part of this repo I'd point someone at first.

`node examples/main.ts` runs each one against good and bad input and prints the formatted errors.

## Performance

Median time to parse, Apple Silicon, Node 24.

| Input          | parserator | parsimmon | `JSON.parse` |
| -------------- | ---------: | --------: | -----------: |
| small (~150B)  |      6.2µs |    11.3µs |        219ns |
| medium (~20KB) |     1.66ms |    3.06ms |       89.4µs |
| large (~350KB) |     77.0ms |   138.6ms |       6.15ms |

`JSON.parse` is still 12 to 28x faster, which is the price of combinators. Three rules hold up in the micro benchmarks. Use `regex` or `takeWhileChar` for runs of characters instead of `many1(digit)`, which is about 80x slower. Put the likeliest alternative first in `or`. Build parsers once, outside any loop. The suite is in [`bench/`](bench) and runs with `pnpm bench`.

## API at a glance

Primitives: `char`, `string`, `regex`, `anyChar`, `oneOfChars`, `anyOfStrings`, `digit`, `alphabet`, `takeWhileChar`, `takeUntil`, `takeUpto`, `eof`, `position`

Combinators: `or`, `optional`, `many`, `many1`, `manyN`, `sepBy`, `sepBy1`, `sepEndBy`, `between`, `sequence`, `count`, `lookahead`, `notFollowedBy`, `zip`, `zipLeft`, `zipRight`, `atomic`, `commit`

Parser methods: `map`, `flatMap`, `zip`, `then`, `thenDiscard`, `trim`, `expect`, `label`, `commit`, `atomic`, `spanned`, `tap`

Constructors: `parser(function* () {})`, `Parser.lazy`, `Parser.lift`, `Parser.error`, `Parser.fatal`

Errors: `ParseErrorBundle`, `ErrorFormatter`, `formatError`

Hints: `anyKeywordWithHints`, `keywordWithHints`, `stringWithHints`, `generateHints`

## License

MIT
