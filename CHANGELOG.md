# Changelog

## Unreleased

- Added `incremental()` sessions and `stream(chunks)` for text and binary
  parsers, using the same generators and combinators as complete-input parsing.
- Incremental sessions return `needMore`, `done`, or `error`; `finish()` marks
  actual end-of-input, and `cancel()` closes suspended generators.
- Preserve parser progress, backtracking, cuts, and bounded binary regions
  across chunks. Character readers handle split UTF-16 surrogate pairs.
- Regex and existing synchronous custom primitives wait for end-of-input.
  Advanced integrations can opt into `makeResumable` and `runResumable`.

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
