/** Compare the same grammars with and without runtime compilation. */
import { deepStrictEqual } from "node:assert"
import { bench, group, run, summary } from "mitata"
import {
  choice,
  digit,
  literal,
  many,
  parser,
  regex,
  sepBy,
  sequence,
  type Parser
} from "../src/index.ts"
import { json } from "../examples/json-parser.ts"
import { csvLines, jsonSmall, jsonMedium } from "./fixtures.ts"

const number = regex(/[0-9]+/).map(Number)
const word = regex(/[a-z]+/)
const comma = literal(",")
const decimal = regex(/[0-9.]+/)
const boolean = choice(literal("true"), literal("false"))
const row = sequence([
  number.zipLeft(comma),
  word.zipLeft(comma),
  decimal.zipLeft(comma),
  boolean
])
const generatedRow = parser(function* () {
  const a = yield* number
  yield* comma
  const b = yield* word
  yield* comma
  const c = yield* decimal
  yield* comma
  const d = yield* boolean
  return [a, b, c, d]
})
const alternatives = many(
  choice(literal("xx"), literal("yy"), literal("zz"), literal("abc"))
)
const cases: Array<[string, Parser<unknown>, string]> = [
  ["literal repetition", many(literal("abc")), "abc".repeat(2000)],
  ["character repetition", many(digit), "1234567890".repeat(100)],
  ["alternative-heavy success", alternatives, "abc".repeat(2000)],
  ["static CSV rows", sepBy(row, literal("\n")), csvLines],
  ["generator CSV rows", sepBy(generatedRow, literal("\n")), csvLines],
  ["JSON small", json, jsonSmall],
  ["JSON medium", json, jsonMedium],
  ["malformed early", sepBy(row, literal("\n")), "!" + csvLines],
  ["malformed late", sepBy(row, literal("\n")), csvLines + "\n1,alpha,2,!"],
  [
    "all alternatives fail",
    choice(literal("abc"), literal("abd"), literal("abe")),
    "ab!"
  ]
]

for (const [name, interpreted, input] of cases) {
  const compiled = interpreted.compile()
  const expected = interpreted.parse(input)
  for (let i = 0; i < 3; i++) {
    const actual = compiled.parse(input)
    deepStrictEqual(
      actual.success ? actual : actual.error.toJSON(),
      expected.success ? expected : expected.error.toJSON()
    )
  }
  group(`${name} (${input.length} UTF-16 units)`, () => {
    summary(() => {
      bench("interpreted", () => interpreted.parse(input))
      bench("compiled", () => compiled.parse(input))
    })
  })
}

// Fresh parser identities prevent the compile cache from hiding startup cost.
group("construction + compilation (small static grammar)", () => {
  bench("compile", () =>
    sequence([literal("("), number, literal(")")]).compile())
})

await run()
