/**
 * Macro benchmark: JSON parsing.
 *
 * Compares the parserator JSON example parser against Parsimmon (the
 * long-standing reference JS combinator library) and native JSON.parse
 * (the theoretical ceiling). Run with: pnpm bench:json
 */
import { bench, group, run, summary } from "mitata"
import { json as parseratorJson } from "../examples/json-parser.ts"
import { ParseErrorBundle } from "../src/index.ts"
import { parseJson as parsimmonJson } from "./json-parsimmon.ts"
import {
  jsonLarge,
  jsonMedium,
  jsonNumbers,
  jsonSmall,
  jsonStrings
} from "./fixtures.ts"

function parserator(input: string): unknown {
  const result = parseratorJson.parseOrError(input)
  if (result instanceof ParseErrorBundle) throw new Error("parse failed")
  return result
}

// Sanity: all parsers must agree with JSON.parse before we measure anything.
for (const [name, fixture] of Object.entries({
  jsonSmall,
  jsonMedium,
  jsonLarge,
  jsonStrings,
  jsonNumbers
})) {
  const expected = JSON.stringify(JSON.parse(fixture))
  for (const [impl, fn] of [
    ["parserator", parserator],
    ["parsimmon", parsimmonJson]
  ] as const) {
    const actual = JSON.stringify(fn(fixture))
    if (actual !== expected) {
      throw new Error(`${impl} disagrees with JSON.parse on ${name}`)
    }
  }
}

const fixtures = [
  ["small (~150B)", jsonSmall],
  ["medium (~20KB)", jsonMedium],
  ["large (~350KB)", jsonLarge],
  ["strings (~60KB)", jsonStrings],
  ["numbers (~16KB)", jsonNumbers]
] as const

for (const [label, fixture] of fixtures) {
  group(`JSON ${label}`, () => {
    summary(() => {
      bench("parserator", () => parserator(fixture))
      bench("parsimmon", () => parsimmonJson(fixture))
      bench("JSON.parse (native)", () => JSON.parse(fixture))
    })
  })
}

await run()
