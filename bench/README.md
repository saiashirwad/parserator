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

The micro CSV comparison constructs shared primitive parsers before timing and
normalizes generator and zip-chain results to the same flat row tuples. Both
results are checked against independently split CSV fixtures before timing.
Older results that constructed primitives inside the generator or returned
nested zip tuples are not directly comparable to this corrected harness.

Tiny malformed-start and malformed-end cases measure parsing plus plain error
formatting, including source names. Their failure offsets and formatted output
are checked before timing. They complement the alternative-heavy backtracking
case; they do not represent large-document diagnostic costs.

Mitata's displayed average is a mean, not a median. Preserve raw output and
report repeated-run variation rather than relabeling these averages as medians.

## Benchmark hygiene

- Build parsers once, outside timed loops.
- Run correctness checks before timing.
- State whether parser construction is included.
- Report input lengths in UTF-16 code units, matching JavaScript offsets.
- Use medians and a measure of variation rather than a single run.
