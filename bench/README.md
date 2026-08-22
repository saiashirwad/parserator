# Benchmarks

Performance harness for parserator. Node ≥ 22.6 runs the TypeScript sources
directly, so benchmarks always measure the current `src/`.

## Running

```sh
pnpm bench          # everything
pnpm bench:json     # macro: JSON parsing vs parsimmon vs native JSON.parse
pnpm bench:micro    # micro: individual combinator primitives
pnpm bench:profile  # CPU-profile the JSON workload and print a self-time report
```

- `json.bench.ts` — parses five deterministic fixtures (small/medium/large,
  string-heavy, number-heavy) with the parserator JSON example parser, an
  equivalent Parsimmon parser, and native `JSON.parse` as the ceiling. All
  implementations are asserted to agree with `JSON.parse` before measuring.
- `micro.bench.ts` — isolates the primitives that dominate real workloads:
  `char`, `string`, `takeWhileChar1` vs `regex` vs `many1(digit)`,
  worst-case `or`, generator vs `zip`-chain sequencing, `sepBy`, and the
  backtracking failure path.
- `profile-json.ts` + `analyze-profile.ts` — capture and summarize a V8
  `.cpuprofile` (self-time per function) to find hotspots.

Fixtures come from `fixtures.ts` and use a seeded PRNG, so runs are
comparable across commits.

## Results (Apple Silicon, Node 24, 2026-07)

JSON macro benchmark, median time per parse:

| Fixture         | parserator (before) | parserator (after) | parsimmon | JSON.parse |
| --------------- | ------------------: | -----------------: | --------: | ---------: |
| small (~150B)   |              18.6µs |              6.2µs |    11.3µs |      219ns |
| medium (~20KB)  |              4.73ms |             1.66ms |    3.06ms |     89.4µs |
| large (~350KB)  |             209.5ms |             77.0ms |   138.6ms |     6.15ms |
| strings (~60KB) |              6.81ms |             2.10ms |    3.33ms |     74.1µs |
| numbers (~16KB) |               884µs |              383µs |    1.04ms |     15.7µs |

Before the optimization pass, parserator was slower than Parsimmon on four of
the five fixtures (up to 2× slower on string-heavy input). It is now
1.6–2.7× faster than Parsimmon on every fixture, at 2.3–3.2× its own
previous speed. Native `JSON.parse` (C++) remains 12–28× faster — that gap
is the cost of the combinator abstraction itself and is similar for every
JS combinator library.

## What made it fast

The CPU profile drove these changes, in order of impact:

1. **Lazy line/column tracking** — `ParserState` no longer carries
   line/column. Advancing the parser used to scan every consumed character
   to maintain them; now spans compute line/column lazily from
   `(source, offset)` only when an error is actually displayed.
2. **Lazy error materialization** — failure objects (`LazyCustomError`)
   defer building their message strings until read. Failures are allocated
   on every backtracked `or`/`optional` alternative and almost all of them
   are discarded, so this removes most template-string and allocation work
   from the failure path.
3. **Direct implementations of `then` / `thenDiscard` / `between` /
   `sepBy1`** — previously built by composing `zip` + `map` (two parser
   wrappers, a tuple allocation, and a closure per element); now single
   wrappers with no intermediate allocations.
4. **`or` reuses the first failing alternative's error array** instead of
   copying it, and returns the successful alternative's output object
   as-is.
5. **`regex` uses a sticky `test()` + slice** instead of `exec()` (no match
   array allocation), and stringifies the pattern once at construction.
6. **`char` compares `charCodeAt`** instead of extracting a one-character
   string.
7. **`Parser.lazy` caches** the parser after the first call instead of
   re-invoking the thunk on every parse.
8. **Single hidden class for states** — states are created by one factory
   with a fixed property order/shape, keeping call sites monomorphic, and
   `many_` only re-allocates a state when the commit flag actually needs
   resetting.

## Guidance for fast parserator parsers

Findings from `micro.bench.ts` worth knowing when writing parsers:

- **Prefer `regex`/`takeWhileChar` over per-character repetition.**
  `regex(/[0-9]+/)` is ~80× faster than `many1(digit).map(join)` — the
  regex engine consumes the run in one call, while `many1(digit)` allocates
  a state per character.
- **Hoist parsers out of loops and generator bodies.** Constructing a
  parser (especially `regex` or `or`) inside a `parser(function* ...)` loop
  rebuilds it on every iteration.
- **`zip`/`then` chains are ~2.7× faster than generator sequencing** for
  hot inner rules; generators cost an iterator per sequence. Keep the
  generator syntax for readability at the grammar level and use method
  chains inside tight loops.
- **Order `or` alternatives by likelihood.** Each failing alternative still
  allocates an error bundle (lazily, but non-zero).
