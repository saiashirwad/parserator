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

The cut is a generation, not a shared Boolean flag. A cut affects the choice,
optional parser, or repetition boundary that surrounds it. A nested boundary
can still make its own decision. `attempt(parser)` isolates cuts made by a
parser when it fails. A fatal failure always stops recovery.

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
if (prefix.success) prefix.value.rest // " remaining"
```

`parseOrThrow()` returns the value or throws a `ParseError`. A parse error is a
real `Error` with a source span, structured expectations, context, and a stable
`toJSON()` representation. `format()` supports plain and ANSI output.

## Building grammars

The root API is deliberately small:

- Primitives: `literal`, `char`, `regex`, `satisfy`, `anyChar`, `eof`.
- Construction: `succeed`, `fail`, and `fatal` create simple parser results.
- Composition: `choice`, `optional`, `many`, `many1`, `count`, `sepBy`,
  `sepBy1`, `sepEndBy`, `between`, `sequence`, `struct`, `recursive`.
- Types come from the parser: `typeof p.Type` is the value a parser `p`
  produces, so grammars need no hand-written result types.
- Control: `commit`, `attempt`, `lookahead`, `notFollowedBy`.
- Expression helpers: `chainLeft1`, `chainRight1`, `prefix`, `postfix`,
  `precedence`.
- Lexical helpers: `createLexemes` with `token`, `symbol`, `keyword`,
  `identifier`, `trivia`, and `complete`.

Parser methods include `map`, `flatMap`, `zip`, `zipLeft`, `zipRight`,
`expected`, `context`, `validate`, and `withSpan`.

### Cookbook

Whitespace and tokens:

```ts
import { createLexemes, regex } from "parserator"

const lex = createLexemes({
  trivia: regex(/[ \t\r\n]*/),
  identifier: regex(/[A-Za-z_][A-Za-z0-9_]*/),
  keywords: ["AND", "OR"] as const
})

const open = lex.symbol("(")
const and = lex.keyword("AND")
```

Lists use explicit names for their trailing-separator rules:
`sepBy` rejects a trailing separator, while `sepEndBy` accepts one. A parser
inside `many` must consume input when it succeeds.

For expressions, make each operator return a function and list precedence
levels from tightest to loosest:

```ts
const expression = precedence(atom, [
  { associativity: "left", operators: [multiply, divide] },
  { associativity: "left", operators: [add, subtract] }
])
```

Use `withSpan` when AST nodes need source locations, and `validate` for local
semantic checks that belong in the grammar.

## Binary input

`parserator/binary` runs the same engine over a `Uint8Array`, with the same
generator style, methods, and combinators. Errors report byte offsets over a
hex dump.

- Integers and floats: `uint8` through `uint64BE/LE`, `int8` through
  `int64BE/LE`, `float32BE/LE`, `float64BE/LE`. `numbers("LE")` returns the
  whole set for one byte order, for formats that declare it in a header.
- Bytes: `bytes(n)`, `magic(signature)`, `skip(n)`, `rest`, `size`,
  `takeWhile(predicate)`, `bytesUntil(byte)`. `hex("ca fe 01")` builds test
  input from hex text.
- Strings: `ascii(n)`, `utf8(n)`, `cstring`. Without `n` the string parsers
  take the rest of the region.
- Layout: `within(n, inner)` parses a length-prefixed region, `at(offset, inner)`
  follows an offset table, and `bitFields(n, inner)` reads packed bits with
  the `bit` namespace.

## Incremental input

The same text and binary grammars can parse input as it arrives. For a stream
of consecutive messages, call `message.stream(chunks)`, where `chunks` is an
iterable or async iterable of strings or byte arrays:

```ts
import * as b from "parserator/binary"

const message = b.parser(function* () {
  const length = yield* b.uint16BE
  return yield* b.utf8(length)
})

// A length-prefixed UTF-8 message split across two network chunks.
const chunks = [b.hex("00 03 61"), b.hex("62 63 00 01 64")]
for await (const value of message.stream(chunks)) {
  console.log(value) // "abc", then "d"
}
```

The runner suspends inside an incomplete message and resumes when another
chunk arrives. Completed reads, generator statements, and callbacks are not
replayed just because input was split. Normal grammar backtracking still
runs alternatives as usual. `stream` yields one message at a time, throws a
parse error on invalid or truncated input, and rejects parsers that succeed
without consuming input. It accepts an empty stream without invoking the
message parser. Offsets and diagnostics start at zero for each message.

For manual input delivery, use an incremental prefix session:

```ts
const session = message.incremental()
session.push(b.hex("00 03 61")) // { status: "needMore" }
session.push(b.hex("62 63"))
// { status: "done", value: "abc", offset: 5, rest: Uint8Array(0) }
```

A result has `status: "needMore"`, `status: "done"` with `value`, `offset`, and
`rest`, or `status: "error"` with the usual parse error. Call `finish()` on an
open session when no more input will arrive; missing required input then
becomes a parse error. An empty chunk is not end-of-input. Call `cancel()` to
abandon a session and close suspended generators, including their `finally`
blocks. A completed, failed, or cancelled session cannot accept more input.
Use a new session for its `rest`, or let `stream` manage that for you.

Like `parsePrefix`, a session finishes when its grammar has a complete value.
Use `grammar.zipLeft(eof).incremental()` when the grammar must consume the
entire input and wait for `finish()` before succeeding. Existing `parse`,
`parsePrefix`, and `parseOrThrow` still take complete input.

Chunk boundaries have no grammatical meaning. `choice` waits for an
incomplete earlier alternative; `many`, `optional`, and lookahead do not
mistake missing input for failure. Greedy text readers wait for a delimiter
or end-of-input. For example, a digit parser reading `123` must wait because
the next chunk might extend the number to `1234`. Text chunks are strings;
decode incoming UTF-8 bytes with a streaming decoder first, or use binary
`utf8(n)` within your message grammar. Split UTF-16 surrogate pairs are handled
by character readers.

Some operations need a definite end boundary:

- `regex` waits for `finish()`. Arbitrary JavaScript regular expressions,
  including lookaround and end anchors, cannot safely finalize against a
  temporary chunk boundary. Use character readers and delimiters when you
  need tokens before the stream ends.
- Binary `rest`, `size`, `ascii()`, and `utf8()` wait for the end of their
  input. Inside `within(n, inner)`, the region is complete once `n` bytes
  arrive. `bitFields(n, inner)` similarly buffers its bounded region; standalone
  bit-input sessions are not supported.
- One session retains its input until it completes, so backtracking and
  absolute `at(...)` reads remain valid. `stream` releases completed message
  input, unless your returned values retain it. Binary chunks are copied on
  arrival; returned byte values and `rest` are views into session-owned memory.

Advanced synchronous primitives made with `makeParser` conservatively wait
for end-of-input. To write a primitive that can suspend, `parserator/advanced`
exports `makeResumable`, `runResumable`, `isFinal`, and `waitForInput`.
Use `yield* runResumable(inner, state)` to compose low-level runners, and
`yield* waitForInput(state)` only when more input can change the answer.
The supplied state's `source` follows the growing input; do not retain a
snapshot of that source across a wait. Custom runners must resolve when
`isFinal(state)` is true.

## Best fit

Parserator works well for search and filter syntax, configuration formats,
formulas, protocol strings, structured CLI fields, and small internal DSLs.

It does not support left recursion or provide multi-error recovery. Parsers
accept complete input or incremental strings and byte arrays. For a large
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
- [`examples/binary/`](examples/binary) — `parserator/binary` on real formats:
  a WAV header, PNG chunks with CRC checks, an IPv4 header with bit fields,
  a framed message protocol with LEB128 lengths, and ELF and ZIP indexes that
  follow offset tables with `at`. Run `node examples/binary/main.ts`.
- [`bench/`](bench) — reproducible performance and profiling harnesses.

Benchmarks report environment-specific measurements when run. They validate
the successful fixtures before timing and do not make a general speed claim.

## Advanced entry points

The package root contains the supported application API. Low-level parser
construction is available from `parserator/advanced`; structured diagnostic
types are available from `parserator/diagnostics`.

## License

MIT
