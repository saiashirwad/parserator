# Benchmarks

The benchmark harness measures the current source, not the last published
package. Node 22.6 or newer can run these TypeScript files directly.

## Running

```sh
pnpm bench          # JSON and micro benchmarks
pnpm bench:json     # JSON parser, Parsimmon, and JSON.parse
pnpm bench:micro    # individual combinators and failure paths
pnpm bench:profile  # V8 CPU profile of the JSON workload
```

`fixtures.ts` creates deterministic, seeded inputs. `json.bench.ts` checks the
successful fixtures against `JSON.parse` before timing. `micro.bench.ts` covers
character runs, alternatives, sequencing, lists, and backtracking failures.
The profile scripts summarize V8 self-time by function.

## Reading results

Results depend on the parser version, Node version, CPU, operating system, and
mitata settings. The harness prints measurements at run time; this document
does not keep copied timing tables or guessed fixture sizes. Record the commit,
runtime, machine, exact input length, and variation with any result you share.

The JSON comparison is a workload comparison, not a product claim. Native
`JSON.parse` is a useful correctness reference and is expected to be faster.
Parsimmon is a familiar combinator baseline, not a target identity.

The next benchmark expansion should include malformed input failing near the
start, malformed input failing near the end, and alternative-heavy failures.
Those cases matter for parser diagnostics and backtracking costs.

## Benchmark hygiene

- Build parsers once, outside timed loops.
- Run correctness checks before timing.
- State whether parser construction is included.
- Report input lengths in UTF-16 code units, matching JavaScript offsets.
- Use medians and a measure of variation rather than a single run.
