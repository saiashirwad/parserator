# Reader-load redesign

## Caller contract

```ts
const lex = createLexemes({
  trivia: regex(/\s*/),
  identifier: /[A-Za-z_][A-Za-z0-9_.]*/,
  keywords: ["AND", "OR"] as const
})
const query = lex.complete(expression).context("query")
const result = query.parsePrefix(input)
if (result.success) consume(result.value, result.offset, result.rest)
```

Keep fluent composition, `yield*`, recursion, named repetition helpers, full-input parsing, `parseOrThrow`, lexical helpers, and precedence. Parser values must remain non-thenable.

## Runtime shape

```ts
type Run<T> = (source: SourceText, offset: number) => Reply<T>
type Reply<T> =
  | {
      readonly ok: true
      readonly value: T
      readonly offset: number
      readonly cut: boolean
    }
  | {
      readonly ok: false
      readonly offset: number
      readonly diagnostic: Diagnostic
      readonly cut: boolean
      readonly fatal: boolean
    }
```

Each invocation reports only cuts made inside that invocation. Child calls receive no inherited cut state. Sequence accumulates cuts. Recovery boundaries inspect the failing child's effects before combining them with earlier successful effects. Successful `attempt` retains cuts. Failed `attempt` clears ordinary cuts, never fatality. Lookahead isolates ordinary cuts on both outcomes.

Retain failure offsets independently of diagnostic spans for advanced composition. Store runners directly on opaque parser values through one internal symbol. Delete the token, registry, and frozen constructor identity. Keep advanced construction and execution behind the advanced entry point.

One parse owns one `SourceText`. Position queries and errors reuse its lazy line index. Character recognition advances by code point; offsets and spans remain UTF-16 code units.

## Diagnostics and grammar helpers

Use required payloads for expected, unexpected, and custom diagnostics. Fatality belongs to reply control and the public parse error, not a second diagnostic category. Diagnostic merging does not merge execution control.

Make `context` failure-only. Wrap explicit completion in the required context. Preserve typo suggestions through one configured word scanner. Lexical completion owns trivia and EOF, not special trailing-keyword recognition.

Share repetition mechanics, preserve item failures below the minimum, and retain discard-only repetition without value retention. Bounded counts may accept zero-width parsers. Unbounded repetitions and every separated-list item require progress.

Each precedence level contains one operator parser. Applications use `choice` to combine operators.

## Ownership

Runtime owns replies, runners, sequencing, generator lifecycle, parse boundaries, and source sessions. Text recognition owns Unicode and sticky regular expressions. Grammar combinators own recovery, repetition, lists, and speculative scanning. Lexemes own word boundaries, vocabulary, and layout. Expressions own associativity and folding. Diagnostics own issue merging, suggestion ranking, and rendering. Export barrels are not execution layers.

## Synthesis decision

The prior investigation compared immutable explicit replies, a mutable checkpoint machine, and conservative generation-based cleanup. Choose explicit replies and call-local cuts. The disposable control probe passed 631,718 comparisons against the generation engine. Reject the mutable machine because checkpoint restoration adds hidden state. Keep the familiar fluent API instead of the candidate's `.then` rename, which would create Promise thenables.

Use a durable baseline replay before changing execution. Implement coupled runtime changes with one owner. Independent workers use separate worktrees. Do not retain compatibility APIs after migrating repository callers.

## Verification gates and commit sequence

1. Capture the original control corpus and benchmark outputs. Commit the reusable replay tool.
2. Delete unused utilities and aliases, simplify rendering, and simplify precedence. Verify each independent unit.
3. Flatten replies and runner storage, replace generation control, migrate all runtime callers, and apply explicit completion context. Replay the original corpus and add focused regression tests.
4. Unify lexical recognition, diagnostic payloads, and repetition rules. Test intended behavior changes separately from control equivalence.
5. Update examples, type tests, package consumers, migration notes, and public exports. Delete legacy mechanisms.
6. Inspect comments and the complete diff. Run typecheck, build, tests, lint, formatting, control replay, offline package smoke, and benchmarks. Review the decision trail.

Temporary breakage is confined to worker worktrees between these gates. Commits are local. Pushes, releases, and pull requests are outside this run.

## Completion predicate

The library has one runner representation and one reply type. Cut generations, the runner registry, successful completion context, the global source cache, unused utilities, the formatter class, and the precedence adapter are absent. Every supported caller uses the new contracts. Full verification passes, control behavior matches the captured baseline except named diagnostic/progress changes, and benchmark results are recorded without unsupported speed claims.

## Measurements

Node v24.21.0, macOS arm64, Apple M5. Baseline source: `89c3a58`; redesigned source: `2ecabb8`. Each timing is the displayed Mitata mean from one process, not a median or a speed guarantee. The baseline has substantial timing tails. Parser construction is excluded except for operations inherently constructed by grammar execution. The corrected CSV benchmark shares primitive parsers and returns identical flat row tuples in both variants.

| Workload                          | Input UTF-16 units | Baseline mean | Redesigned mean |
| --------------------------------- | -----------------: | ------------: | --------------: |
| JSON small                        |                116 |      40.01 µs |        12.13 µs |
| JSON medium                       |             34,566 |      10.36 ms |         3.40 ms |
| JSON large                        |          1,480,160 |     529.03 ms |       151.01 ms |
| JSON strings                      |             67,781 |      11.91 ms |         4.08 ms |
| JSON numbers                      |             11,189 |       1.46 ms |         1.20 ms |
| Corrected generator CSV           |             21,402 |     551.07 µs |       400.83 µs |
| Corrected zip CSV                 |             21,402 |     379.59 µs |       202.68 µs |
| Identifier separated list         |             19,389 |     139.79 µs |        85.26 µs |
| Malformed start, parse and format |                  5 |       4.12 µs |         3.80 µs |
| Malformed end, parse and format   |                  5 |       4.19 µs |         3.86 µs |

Raw outputs are under `/private/var/folders/_f/yb2trsh50c1gv2dpybhtbw7r0000gn/T/opencode/`:

- `parserator-baseline-json.txt`
- `parserator-corrected-baseline-micro.txt`
- `parserator-final-json.txt`
- `parserator-final-micro.txt`

The original generator CSV benchmark built primitive parsers during execution and returned a different shape from the zip benchmark. Its original timing is not a comparison target. No allocation claim follows from the reporter's invalid `Infinity` and `NaN` rows. These measurements do not cover large malformed documents, concurrent parsing, or retained advanced replies.
