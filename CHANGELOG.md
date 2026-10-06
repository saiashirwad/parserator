# Changelog

## Unreleased

### BREAKING: reader and runner contracts

- `Parser<T>` is opaque and type-only. Replace public constructor usage with
  combinators, `parser(function* () { ... })`, or advanced `makeParser`.
  Fluent composition and `yield*` remain supported; parsers are not thenables.
  Use `yield*` for typed results: plain `yield` resumes with `unknown` and must
  not supply unchecked typed values. Cancellation forces iterator unwinding
  until done without running parser effects yielded from cleanup. Release
  resources in non-yielding `finally` blocks, including nested ones; normal
  completion may execute parsers yielded from `finally`.
- Prefix successes are flat. After checking `result.success`, migrate:

  ```ts
  // Before
  const { value, offset, rest } = result.value
  // After
  const { value, offset, rest } = result
  ```

- Advanced runners now receive `(source: SourceText, offset: number)`, not a
  parser state. Call `runParser(p, source, offset)`. Replace nested result/state
  fields with flat replies: `{ ok: true, value, offset, cut }` or
  `{ ok: false, offset, diagnostic, cut, fatal }`. Failure offsets remain
  independent of diagnostic spans. `replySuccess` and `replyFailure` accept
  offsets directly. Cuts are call-local effects, not generations; failed
  `attempt` clears ordinary cuts, successful `attempt` retains them, and fatal
  failures never recover. Custom runners are trusted: input and returned
  offsets must be safe integers within the source length (inclusive), without
  runtime bounds validation. Compose returned child cut effects explicitly.
- `SourceText` is no longer a root export; use `parserator/advanced` or
  `parserator/diagnostics`. Hint ranking utilities belong to diagnostics.
  Source sessions own their lazy line index; there is no global source cache.
- Lexemes take an identifier regular expression, not an identifier parser:

  ```ts
  // Before
  createLexemes({ trivia, identifier: regex(/[A-Za-z_][A-Za-z0-9_.]*/) })
  // After
  createLexemes({ trivia, identifier: /[A-Za-z_][A-Za-z0-9_.]*/ })
  ```

  This one scanner defines identifiers, whole-word keywords, and typo spans.
  Dotted and Unicode continuations count as part of a word when included in
  the expression. Keywords must be nonempty complete identifier matches;
  unconfigured keyword requests and zero-width identifier matches throw.

- Each precedence level accepts one `operator` parser. Combine alternatives
  explicitly:

  ```ts
  // Before
  { associativity: "left", operators: [add, subtract] }
  // After
  { associativity: "left", operator: choice(add, subtract) }
  ```

- Context is failure-only. To label completion errors, replace
  `expression.context("query").parse(input)` with
  `lex.complete(expression).context("query").parse(input)` (or wrap an explicit
  `zipLeft(eof)`). Successful context does not annotate the implicit EOF check.
- Fatality is separate from diagnostic kind: replace
  `error.diagnostic.kind === "fatal"` with `error.fatal`; serialized errors
  expose `fatal` too. Expected diagnostics require nonempty labels, unexpected
  diagnostics require `found`, and custom diagnostics require `message`.
  Replace expected/message combinations with either an expected diagnostic
  or a custom diagnostic: `message` belongs only to custom diagnostics.
  At the furthest `span.start`, merge priority is custom → unexpected → expected.
  The deepest context wins within that kind, with encounter order breaking
  ties. Winning expectations and all hints at that position merge in stable
  encounter order with duplicates removed; expected spans extend to the
  largest expected end offset.
- Replace `ErrorFormatter` instances with the pure
  `formatError(error, options)` from `parserator/diagnostics`, or `error.format(options)`.
- Named repetition helpers share progress rules: finite `count(p, n)` allows
  zero-width successes, but `many`, `many1`, `skipMany`, and `atLeast` reject
  them. Every separated-list item must advance, including the first. Below a
  required minimum, failures preserve the item diagnostic instead of replacing
  it with a generic minimum-count error. Counts must be safe nonnegative integers.

## 0.2.0

This release defines a smaller, safer public API. It is a breaking release;
there is no compatibility layer for 0.1.

- `parse()` now consumes the complete input and returns a discriminated
  `ParseResult`.
- `parsePrefix()` is available when a caller needs prefix parsing.
- Parse failures are proper `ParseError` values with structured diagnostics.
- `commit()` uses scoped cut generations. `attempt()` isolates cuts, while
  fatal failures always stop recovery.
- Removed `.then()`, `thenDiscard()`, `or`, `string` aliases, and old parser
  state/output/error internals from the recommended public surface. Use
  `zipRight`, `zipLeft`, `choice`, `literal`, and the result/error APIs.
- Added `recursive`, `createLexemes`, and expression helpers for small DSLs.
- ESM distribution targets ES2022 and requires Node 22 or newer.
