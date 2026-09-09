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
  `sepBy1`, `sepEndBy`, `between`, `recursive`.
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

## Compile a parser

Keep writing the same parsers, then opt in once at the application boundary:

```ts
const fastPoint = point.compile()

fastPoint.parseOrThrow("(10,20)") // { x: 10, y: 20 }
fastPoint.parse("(10,20)")
fastPoint.parsePrefix("(10,20) remaining")
```

`.compile()` returns a normal `Parser<T>` with the same result type, methods,
backtracking rules, cuts, spans, and diagnostics. The original parser stays
interpreted. Compilation is cached: calling it again returns the same compiled
parser, and compiled parsers can still be composed and yielded with `yield*`.

The compiler uses `new Function` to generate direct calls and specialized loops
for static compositions. It avoids intermediate success replies on those paths
and delays diagnostics for alternatives ruled out by literal or regex prefixes.
Grammar strings and callbacks are passed as data, never interpolated as code.

Generators keep their ordinary JavaScript control flow. Their reusable yielded
parsers, and parsers returned by `flatMap`, compile lazily when reused. Recursive
builders also remain lazy. One-off dynamic parsers and opaque advanced runners
use their existing implementation. Callbacks execute during parsing, including
normal speculative calls during backtracking; compilation does not execute them.

Compile outside the parse loop and reuse the result. Hoist reusable parsers out
of generators when practical. Static compositions typically benefit most;
generator-heavy grammars and failure-heavy inputs can see smaller gains or a
slowdown. Measure your grammar with `pnpm bench:compile`, which compares identical
inputs and reports construction/compilation separately from warmed parsing.

Runtime compilation requires an environment that permits `new Function`. It
throws if code generation is blocked (for example by a browser's Content Security
Policy). Ordinary parsing never requires runtime code generation.

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

The package root contains the supported application API. Low-level parser
construction is available from `parserator/advanced`; structured diagnostic
types are available from `parserator/diagnostics`.

## License

MIT
