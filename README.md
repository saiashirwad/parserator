# Parserator

Parserator is a TypeScript parser-combinator library for application-defined syntax: search queries, configuration, formulas, and command languages. Grammars are composed from reusable parser values and produce the data structures you choose, from a single parsed value to a typed syntax tree. There is no separate grammar language or code-generation step.

The generator API makes sequential grammars read like sequential code. Delegating to a parser with `yield*` binds its result with its inferred TypeScript type. The generator's return value defines the composed parser's output. This makes data-dependent grammars straightforward to express, while retaining standard combinators for alternatives, repetition, recursion, and precedence. Parserator manages input positions, backtracking, and structured diagnostics. Your application decides what to do with a successful result.

## A command grammar

```sh
npm install parserator
```

The package is ESM-only, has no runtime dependencies, and requires Node.js 22 or newer. Its build target is ES2022.

This grammar accepts `resize 640 x 480` and `rotate 90`, producing a discriminated union rather than executing either command:

```ts
import { choice, createLexemes, parser, regex } from "parserator"

const lex = createLexemes({
  trivia: regex(/\s*/),
  identifier: /[a-z]+/,
  keywords: ["resize", "rotate"]
})

const integer = lex.token(regex(/\d+/)).map(Number).expected("integer")

const commandBody = parser(function* () {
  const type = yield* choice(lex.keyword("resize"), lex.keyword("rotate"))

  if (type === "rotate") {
    const degrees = yield* integer
    return { type, degrees }
  }

  const width = yield* integer
  yield* lex.symbol("x")
  const height = yield* integer
  return { type, width, height }
})

const command = lex.complete(commandBody).context("image command")

command.parseOrThrow("resize 640 x 480")
// { type: "resize", width: 640, height: 480 }

command.parseOrThrow("  rotate 90  ")
// { type: "rotate", degrees: 90 }
```

`commandBody` sequences parsers against a shared input position. Each `yield*` either supplies the parser's result or propagates its failure, while `return` constructs the output. The keyword choice infers `"resize" | "rotate"`. Narrowing that value determines which fields each branch returns.

The resulting parser can be reused across inputs, or embedded in a larger grammar before `lex.complete` supplies the whole-input boundary. Use `yield*`, not plain `yield`, for typed delegation. Explicit output contracts can use the type-only `Parser<T>` export. Parsers are created through factories, not a public constructor.

### Tokens and whitespace

`createLexemes` establishes a lexical policy shared by the grammar. The `trivia` parser consumes ignored text—whitespace here, or comments in a more elaborate grammar. `token(p)`, `symbol`, and `keyword` consume trailing trivia. `complete(p)` consumes leading and trailing trivia and requires the end of the input. `/\s*/` accepts empty trivia, so whitespace is permitted rather than required.

The identifier RegExp defines whole-word recognition for both `lex.identifier` and keywords. Under `/[a-z]+/`, `resizeable` remains one identifier instead of matching the keyword `resize` as a prefix. Configured keywords are case-sensitive and reserved from identifiers. Close misspellings can produce diagnostic suggestions.

Raw `literal`, `char`, and `regex` parsers do not skip trivia. A regex matches at the current position, not the next matching position, and returns the complete matched text. A literal does not enforce word boundaries. Use these primitives directly when the grammar needs exact control over spacing and token boundaries.

## Decide how to handle invalid input

Use `parse` for user input. Failure becomes a value you can handle:

```ts
const result = command.parse("rotate nope", { sourceName: "command" })

if (result.success) {
  console.log(result.value)
} else {
  console.error(result.error.format({ style: "plain" }))
}
```

```text
command:line 1, column 8:
> 1 | rotate nope
    |        ^
Expected integer, found n
While parsing: image command
```

The error is a `ParseError`, not just a string. `error.diagnostic` contains the source `span`, a diagnostic `kind`, and expectations or a custom message, with optional context and suggestions. `error.toJSON()` makes the diagnostic available to an editor or other UI. Spans are half-open UTF-16 string indexes: `{ start, end }` selects `input.slice(start, end)`. `format` can produce plain or ANSI text.

Use `.expected("integer")` to give a low-level parser a useful expectation and `.context("image command")` to name the surrounding grammar. Context only decorates failures in the wrapped parser. Wrapping `lex.complete(...)` also includes failures caused by trailing input.

| Entry point             | On success                               | Input rule                                               |
| ----------------------- | ---------------------------------------- | -------------------------------------------------------- |
| `p.parse(input)`        | `{ success: true, value }`               | All input must be consumed.                              |
| `p.parseOrThrow(input)` | The parsed value                         | All input must be consumed; failure throws `ParseError`. |
| `p.parsePrefix(input)`  | `{ success: true, value, offset, rest }` | A prefix is enough.                                      |

`parse` and `parsePrefix` both return `{ success: false, error }` on a parsing failure. They do not catch exceptions thrown by your callbacks. Whole-input parsing does not automatically trim whitespace. Our example accepts it because it explicitly uses `lex.complete`.

```ts
const number = regex(/\d+/).map(Number)
number.parsePrefix("42 more")
// { success: true, value: 42, offset: 2, rest: " more" }

number.parse("42 more").success // false
```

Use a grammar without `complete` for prefix parsing or embedding inside another grammar. `commandBody` can be nested. `command` deliberately requires EOF and is a whole-input entry point.

## Grow a grammar from the pieces you already have

`map` changes the returned value, not the text consumed. `validate` adds a local semantic check:

```ts
const positiveInteger = integer.validate(n => n > 0, "must be positive")
```

For several commands separated by semicolons, reuse the inner grammar:

```ts
import { sepBy1 } from "parserator"

const commands = lex.complete(sepBy1(commandBody, lex.symbol(";")))
commands.parseOrThrow("rotate 90; resize 640 x 480")
// [
//   { type: "rotate", degrees: 90 },
//   { type: "resize", width: 640, height: 480 }
// ]
```

`sepBy1` requires at least one item and rejects a trailing separator. Choose `sepBy` to allow an empty list, or `sepEndBy`/`sepEndBy1` to allow a trailing separator. `many(p)` repeats without a separator. `many1(p)` requires at least one match. A repeated parser must consume text whenever it succeeds, so do not put a possibly-empty match like `regex(/\s*/)` inside `many`.

For a recursive grammar, `recursive(self => ...)` supplies a reference to the parser you're constructing. For example, nested brackets can use `between(open, close, self)`. Recursive paths must consume input before calling themselves. Left-recursive grammars are not supported.

### Expressions with precedence

An operator parser returns a function describing how to combine its operands. `precedence` applies those functions, with levels listed from tightest to loosest:

```ts
import { literal, precedence } from "parserator"

const atom = regex(/\d+/).map(Number)
const expression = precedence(atom, [
  {
    associativity: "left",
    operator: literal("*").map(() => (a: number, b: number) => a * b)
  },
  {
    associativity: "left",
    operator: literal("+").map(() => (a: number, b: number) => a + b)
  }
])

expression.parseOrThrow("2+3*4") // 14
```

These functions can build syntax-tree nodes instead of evaluating immediately. Use `chainLeft1` or `chainRight1` for a single binary operator level, and `prefix`/`postfix` for unary operators. Parentheses require an explicit recursive grammar. This example only accepts numbers, `+`, and `*`, with no whitespace.

## Understand when alternatives are retried

`choice(a, b)` tries `a`, then tries `b` from the same starting position if `a` fails ordinarily—even if `a` read some input first. The first successful alternative wins. A later EOF failure does not cause `choice` to revisit an already-successful alternative.

That matters for overlapping tokens: `choice(literal(">"), literal(">="))` accepts `>` first. Use `oneOfLiterals(">", ">=")` to try the longest literal first, or order `choice` alternatives explicitly.

Once a prefix identifies a branch, you can stop a misleading fallback with `commit()`:

```ts
import { commit, literal } from "parserator"

const assignment = parser(function* () {
  const name = yield* regex(/[a-z]+/)
  yield* literal("=")
  yield* commit()
  const value = yield* regex(/\d+/).map(Number).expected("assignment value")
  return { name, value }
})

const nameOrAssignment = choice(assignment, regex(/[a-z]+/))
nameOrAssignment.parseOrThrow("size=12") // { name: "size", value: 12 }
// "size=" fails with "assignment value", rather than falling back to a bare name.
```

The cut applies at the surrounding recovery boundary, not globally to every nested parser. `attempt(p)` permits recovery from an ordinary committed failure. `fatal(message)` prevents recovery even through `attempt`. `lookahead(p)` checks a parser without consuming input and isolates ordinary cuts. `optional(p)` returns `undefined` on an ordinary uncommitted failure.

Keep parsing callbacks free of application side effects. Retrying a branch rewinds the input position, not external mutations. Run the returned command after parsing succeeds.

## Find the tool you need

You can compose parsers with `yield*` or with methods. `.zip(p)` keeps both results, `.zipLeft(p)` keeps the first, `.zipRight(p)` keeps the second, and `.flatMap(f)` chooses the next parser using a previous result.

| Task                              | API                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Read text or a character          | `literal(text)`, `char(codePoint)`, `regex(pattern)`, `satisfy(predicate, description)`, `anyChar()` |
| Read common characters            | `digit`, `asciiLetter`, `asciiAlphanumeric`, `whitespace` (each consumes one character)              |
| Combine alternatives or sequences | `choice(...parsers)`, `oneOfLiterals(...texts)`, `sequence([parsers])`                               |
| Match delimiters                  | `between(open, close, inner)`                                                                        |
| Repeat or discard                 | `many(p)`, `many1(p)`, `skipMany(p)`, `count(p, n)`, `atLeast(p, n)`                                 |
| Read separated lists              | `sepBy`, `sepBy1`, `sepEndBy`, `sepEndBy1` (item parser, separator parser)                           |
| Check without consuming           | `lookahead(p)`, `probe(p)`, `notFollowedBy(p)`                                                       |
| Return or reject explicitly       | `succeed(value)`, `fail(message)`, `fatal(message)`                                                  |
| Track source locations            | `position`, `p.withSpan((value, span) => ...)`                                                       |
| Require completion                | `eof`, `createLexemes(...).complete(p)`                                                              |
| Skip or collect until a delimiter | `takeUntil(p)`, `takeUpto(p)`, `skipUntil(p)`                                                        |
| Read a nonempty character run     | `takeWhileChar1(predicate, description)`                                                             |

`takeUntil` consumes its matched delimiter. `takeUpto` leaves it for the next parser. Both succeed at EOF if no delimiter is found, so they alone do not enforce a required closing delimiter. `skipUntil` consumes the delimiter and discards the text.

For suggestions without a lexical layer, use `keywordWithHints(vocabulary)(word)`, `anyKeywordWithHints(vocabulary)`, and `stringWithHints(values)`. The last accepts only double-quoted known values. It does not decode escapes or recognize escaped quotes, and is not a general-purpose JSON string parser.

Most applications only need `parserator`. For custom scanners, `parserator/advanced` exposes `makeParser`, `runParser`, `replySuccess`, `replyFailure`, and `SourceText`. A runner receives `(source, offset)` and returns a success or failure reply. This is trusted low-level code: keep offsets within the source string, reuse the source session, and propagate each child runner's local cut effects explicitly. `Parser` remains a type, not a public constructor.

`parserator/diagnostics` provides `SourceText`, `positionAt`, `spanAt`, `formatError`, `generateHints`, and `levenshteinDistance` for working with locations, formatting, and suggestions outside a grammar.

## Is it a good fit?

Use Parserator when an application has a small language of its own: filter queries, command fields, formulas, configuration, or an internal DSL. A regular expression is still useful for reading individual tokens. Parserator gives those tokens structure, typed results, and parse errors.

It parses an in-memory string synchronously. It does not offer streaming input, left recursion, or multi-error recovery. For an existing standard format, start with its dedicated parser. For a full compiler or editor language service needing recovery and grammar analysis, choose a toolkit designed for that job.

## See complete grammars

The [query-language example](examples/query-language/) is a good next step. It builds a typed syntax tree for comparisons and `AND`/`OR`, handles parentheses and keyword boundaries, and includes an evaluator and malformed-input tests.

Other repository examples cover [JSON](examples/json-parser.ts), [INI](examples/ini-parser.ts), [Scheme](examples/scheme-parser.ts), and an [ML-like language](examples/toyml/). These are source examples to study, not exports from the npm package. Use `JSON.parse` for production JSON parsing.

For repository development, run `pnpm install` and `pnpm run ci`. The [benchmark harness](bench/) is available with `pnpm run bench`. Its measurements depend on the environment and are not a blanket speed claim.

[Changelog](CHANGELOG.md) · [MIT license](LICENSE)
