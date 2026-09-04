/**
 * Macro benchmark: JSON parsing.
 *
 * Compares the parserator JSON example parser against Parsimmon (the
 * long-standing reference JS combinator library) and native JSON.parse
 * (the theoretical ceiling). Run with: pnpm bench:json
 */
import { bench, group, run, summary } from "mitata"
import { json as parseratorJson } from "../examples/json-parser.ts"
import { parseJson as parsimmonJson } from "./json-parsimmon.ts"
import {
  jsonLarge,
  jsonMedium,
  jsonNumbers,
  jsonSmall,
  jsonStrings
} from "./fixtures.ts"

function parserator(input: string): unknown {
  const result = parseratorJson.parse(input)
  if (!result.success) throw result.error
  return result.value
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
  ["small", jsonSmall],
  ["medium", jsonMedium],
  ["large", jsonLarge],
  ["strings", jsonStrings],
  ["numbers", jsonNumbers]
] as const

for (const [label, fixture] of fixtures) {
  group(`JSON ${label} (${fixture.length} UTF-16 units)`, () => {
    summary(() => {
      bench("parserator", () => parserator(fixture))
      bench("parsimmon", () => parsimmonJson(fixture))
      bench("JSON.parse (native)", () => JSON.parse(fixture))
    })
  })
}

await run()
