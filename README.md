# Parserator

Readable, type-safe parsers for small TypeScript application languages.

Parserator is for the point where a regular expression has become brittle,
but a parser generator would be too much. Grammars are ordinary generator
functions, so local variables, conditions, and loops stay visible.

```sh
npm install parserator
```

Parserator is ESM-only, has no runtime dependencies, targets ES2022, and
supports Node 22 and newer.

## A small parser

```ts
import { char, parser, regex } from "parserator"

const number = regex(/-?\d+/).map(Number)
const point = parser(function* () {
  yield* char("(")
  const x = yield* number
  yield* char(",")
  const y = yield* number
  yield* char(")")
  return { x, y }
})

point.parseOrThrow("(10,20)")
// { x: 10, y: 20 }
```

## A useful application grammar

The query example parses a filter that an application could put in a search
box:

```ts
import { query, queryLexemes } from "./examples/query-language/parser.ts"
import { evaluate } from "./examples/query-language/evaluate.ts"

const filter = query.parseOrThrow("status:open AND (owner:me OR priority >= 3)")

evaluate(filter, { status: "open", owner: "other", priority: 3 })
// true

console.dir(filter, { depth: null })
// {
//   type: "logical", operator: "AND",
//   left: { type: "comparison", field: "status", operator: ":", value: "open" },
//   right: {
//     type: "logical", operator: "OR",
//     left: { type: "comparison", field: "owner", operator: ":", value: "me" },
//     right: { type: "comparison", field: "priority", operator: ">=", value: 3 }
//   }
// }
```

The example has a typed AST, keyword boundaries, parentheses, comparisons,
operator precedence, dotted fields, evaluation, and malformed-input tests.
It is in [`examples/query-language/`](examples/query-language).

Malformed input stays structured and points to the operand that is missing:

```ts
const result = query.parse("status:open AND owner:")
if (!result.success) {
  result.error.diagnostic
  // {
  //   kind: "expected", span: { start: 22, end: 22 },
  //   expected: ["query value"], context: ["comparison"]
  // }
  console.error(result.error.format({ style: "plain" }))
}
```

The lexical layer also suggests a known keyword for a close typo:

```ts
const keyword = queryLexemes.keyword("AND").parse("AN")
if (!keyword.success) keyword.error.diagnostic.hints // ["AND", "OR"]
```

## The core idea

`parser(function* () {})` sequences parsers with `yield*`. The yielded value
has the parser's result type, and the generator's `return` type becomes the
new parser's type.

`choice(a, b, c)` tries alternatives in order and backtracks input by default,
even when an alternative consumed text. Use `commit()` after the input has
identified a branch:

```ts
import { commit, literal, parser, regex } from "parserator"

const identifier = regex(/[A-Za-z_][A-Za-z0-9_]*/)
const letExpression = parser(function* () {
  yield* literal("let")
  yield* commit()
  const name = yield* identifier.expected("variable name")
  yield* literal("=").expected("'=' after variable name")
  return name
})
```

Each parser invocation reports only its own cuts. A cut affects the choice,
optional parser, or repetition boundary that surrounds it; a nested boundary
can still recover independently. `attempt(parser)` clears ordinary cuts on
failure, but keeps them on success. `lookahead` isolates ordinary cuts and
consumes no input. A fatal failure always stops recovery.

Keep parser callbacks pure. A speculative branch may run more than once after
backtracking; perform side effects only after parsing succeeds.

## Results and diagnostics

`parse()` consumes the complete input and returns a discriminated result:

```ts
const result = point.parse("(10,20)")
if (result.success) {
  result.value
} else {
  console.error(result.error.format({ style: "plain" }))
}
```

Use `parsePrefix()` when a caller deliberately wants a prefix and the rest:

```ts
const prefix = number.parsePrefix("42 remaining")
if (prefix.success) {
  prefix.value // 42 (number)
  prefix.offset // 2 (UTF-16 code units)
  prefix.rest // " remaining"
}
```

`parseOrThrow()` returns the value or throws a `ParseError`. A parse error is a
real `Error` with a source span, structured expectations, context, and a stable
`toJSON()` representation. `error.fatal` and `error.toJSON().fatal` report
fatality independently of `diagnostic.kind`. Diagnostic kinds are `expected`
(with nonempty expectation labels), `unexpected` (with `found`), and `custom`
(with `message`). Custom messages do not override expected diagnostics.
`format()` supports plain and ANSI output; `formatError(error, options)` from
`parserator/diagnostics` is the pure function form, not a formatter class.

`context()` adds context only when its wrapped parser fails. To include a
trailing-input error, wrap explicit completion: `lex.complete(expression).context("query")`
or `expression.zipLeft(eof).context("query")`. A successful inner context does
not carry forward to the implicit EOF check in `parse()`.

## Building grammars

The root API is deliberately small:

- Primitives: `literal`, `char`, `regex`, `satisfy`, `anyChar`, `eof`.
- Construction: `succeed`, `fail`, and `fatal` create simple parser results.
- Composition: `choice`, `sequence`, `optional`, `many`, `many1`, `skipMany`,
  `count`, `atLeast`, `sepBy`, `sepBy1`, `sepEndBy`, `sepEndBy1`, `between`, `recursive`.
- Control: `commit`, `attempt`, `lookahead`, `probe`, `notFollowedBy`.
- Scanning: `takeUntil`, `takeUpto`, `skipUntil`, `takeWhileChar1`.
- Character helpers: `oneOfLiterals`, `digit`, `asciiLetter`,
  `asciiAlphanumeric`, `whitespace`, `position`.
- Standalone hints: `keywordWithHints`, `anyKeywordWithHints`, `stringWithHints`.
- Expression helpers: `chainLeft1`, `chainRight1`, `prefix`, `postfix`,
  `precedence`.
- Lexical helpers: `createLexemes` with `token`, `symbol`, `keyword`,
  `identifier`, `trivia`, and `complete`.

`Parser<T>` is an opaque, type-only export, not a public constructor. Create
parsers with the functions above and compose them with `yield*` or methods:
`map`, `flatMap`, `zip`, `zipLeft`, `zipRight`, `expected`, `context`, `validate`,
`withSpan`, `trim`, `trimLeft`, `trimRight`, and `commit`. Parser values have no
`.then` method and are safe to pass to `Promise.resolve`.

### Cookbook

Whitespace and tokens:

```ts
import { createLexemes, regex } from "parserator"

const lex = createLexemes({
  trivia: regex(/[ \t\r\n]*/),
  identifier: /[\p{L}_][\p{L}\p{N}_.]*/u,
  keywords: ["AND", "OR"] as const
})

const open = lex.symbol("(")
const and = lex.keyword("AND")
```

`identifier` is a `RegExp`, not a parser. One sticky scanner defines both
identifiers and whole-word keywords. With the expression above, `ANDé` and
`AND.field` are single identifiers, not keyword `AND` followed by a suffix.
Other expressions define other boundaries. Keywords must be nonempty complete
matches of that expression; duplicates are removed, and requesting an
unconfigured keyword throws. Empty identifier matches throw (at construction
when detectable on empty input, otherwise when scanning). Reserved keywords
are rejected by `lex.identifier`. The same vocabulary supplies typo hints.

`token`, `symbol`, `keyword`, and `identifier` consume trailing trivia.
`complete(p)` consumes leading and trailing trivia and requires EOF; it does
not do a separate trailing-keyword recognition pass.

Lists use explicit names for their trailing-separator rules: `sepBy` rejects a
trailing separator, while `sepEndBy` accepts one. Their `1` variants require at
least one item. Every successful list item, including the first, must advance.
`many`, `many1`, `atLeast`, and discard-only `skipMany` also require progress
on every success. `count(p, n)` is finite and permits zero-width successes;
`count` and `atLeast` require a safe nonnegative integer. Failures below a
required minimum preserve the failing item's diagnostic.

`takeUntil(delimiter)` returns text before the delimiter but consumes the
matched delimiter. `takeUpto(delimiter)` returns the same text and leaves the
delimiter unconsumed. `skipUntil` consumes it and returns `undefined`. All
three succeed at EOF if no delimiter matches, ignoring ordinary delimiter
failures/cuts but propagating fatal failures. Scanning advances by Unicode
code point; all offsets and spans use UTF-16 code units.

Standalone `keywordWithHints(vocabulary)(word)` and
`anyKeywordWithHints(vocabulary)` use the word expression
`/[\p{L}_][\p{L}\p{N}_'.-]*/u`, including dotted words.
`stringWithHints(values)` accepts a double-quoted member of `values` and
suggests close matches. Its grammar is deliberately limited: it reads until
the next double quote, permits raw newlines, and does not decode escapes or
support escaped quotes. It is not a JSON string parser.

For expressions, make each operator return a function and list precedence
levels from tightest to loosest:

```ts
import { choice, literal, precedence, regex } from "parserator"

const atom = regex(/\d+/).map(Number)
const multiply = literal("*").map(() => (a: number, b: number) => a * b)
const divide = literal("/").map(() => (a: number, b: number) => a / b)
const add = literal("+").map(() => (a: number, b: number) => a + b)
const subtract = literal("-").map(() => (a: number, b: number) => a - b)
const expression = precedence(atom, [
  { associativity: "left", operator: choice(multiply, divide) },
  { associativity: "left", operator: choice(add, subtract) }
])
expression.parseOrThrow("2+3*4") // 14
```

Use `withSpan` when AST nodes need source locations, and `validate` for local
semantic checks that belong in the grammar.

## Best fit

Parserator works well for search and filter syntax, configuration formats,
formulas, protocol strings, structured CLI fields, and small internal DSLs.

It is not a streaming parser, does not support left recursion, and does not
provide multi-error recovery. Input is a string held in memory. For a large
language, token recovery, grammar analysis, or generated syntax diagrams, use
a parser toolkit built for compilers.

## Examples and benchmarks

- [`examples/query-language/`](examples/query-language) — typed query AST and
  evaluator; the main application example.
- [`examples/json-parser.ts`](examples/json-parser.ts) — recursive grammar and
  escaping example; not a replacement for `JSON.parse`.
- [`examples/toyml/`](examples/toyml) — an ML-like grammar with recursion,
  patterns, records, and variants.
- [`examples/ini-parser.ts`](examples/ini-parser.ts) and
  [`examples/scheme-parser.ts`](examples/scheme-parser.ts) — smaller complete
  grammars.
- [`bench/`](bench) — reproducible performance and profiling harnesses.

Benchmarks report environment-specific measurements when run. They validate
the successful fixtures before timing and do not make a general speed claim.

## Advanced entry points

The root exports application combinators, the `Parser<T>` type, `ParseError`,
and diagnostic types. Import `SourceText` from `parserator/advanced` or
`parserator/diagnostics`, not the root. Diagnostic helpers `positionAt`,
`spanAt`, `formatError`, `generateHints`, and `levenshteinDistance` live in
`parserator/diagnostics`.

`parserator/advanced` exports `makeParser`, `runParser`, `replySuccess`,
`replyFailure`, and types `Run<T>` and `Reply<T>`. A runner receives
`(source: SourceText, offset: number)` and returns one flat reply:

- Success: `{ ok: true, value, offset, cut }`.
- Failure: `{ ok: false, offset, diagnostic, cut, fatal }`.

The failure offset is execution position, independent of the diagnostic span.
Report only cuts made by this invocation; child runners receive no inherited
cut state. Reuse the same `SourceText` when composing runners. One public
parse call creates one source session with a lazy line index.

Here is a custom scanner for a single Unicode code point:

```ts
import { makeParser, runParser, SourceText } from "parserator/advanced"

const codePoint = makeParser<string>((source, offset) => {
  const value = source.charAt(offset)
  return value
    ? {
        ok: true,
        value,
        offset: offset + source.charWidthAt(offset),
        cut: false
      }
    : {
        ok: false,
        offset,
        cut: false,
        fatal: false,
        diagnostic: {
          kind: "expected",
          span: { start: offset, end: offset },
          expected: ["code point"]
        }
      }
})
const reply = runParser(codePoint, new SourceText("😀!", "input.txt"), 0)
if (reply.ok) console.log(reply.value, reply.offset) // 😀 2
```

`replySuccess(value, offset, cut = false)` and
`replyFailure(diagnostic, offset, cut = false, fatal = false)` construct the
same flat shapes. Every diagnostic has a span, with optional `context` and
`hints`. Expected diagnostics require nonempty `expected` labels and may have
`found`; unexpected diagnostics require `found`; custom diagnostics require
`message`. Use a custom diagnostic for prose, not a `message` override on an
expected diagnostic.

## License

MIT
