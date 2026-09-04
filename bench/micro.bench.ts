/**
 * Micro benchmarks for individual combinators — these isolate the primitives
 * that dominate real parser workloads so regressions are attributable.
 * Run with: pnpm bench:micro
 */
import { bench, group, run, summary } from "mitata"
import {
  char,
  digit,
  many,
  many1,
  choice,
  parser,
  regex,
  sepBy,
  literal,
  takeWhileChar1
} from "../src/index.ts"
import { csvLines, identifiers } from "./fixtures.ts"

const digits1k = "1234567890".repeat(100)
const abcs = "abc".repeat(2000)
const spacedWords = identifiers

group("primitive: char", () => {
  const p = many(char("a"))
  const input = "a".repeat(1000)
  bench("many(char('a')) x1000", () => p.parseOrThrow(input))
})

group("primitive: literal", () => {
  const p = many(literal("abc"))
  bench("many(literal('abc')) x2000", () => p.parseOrThrow(abcs))
})

group("primitive: takeWhileChar1 vs regex vs many1(digit)", () => {
  summary(() => {
    const tw = takeWhileChar1(ch => ch >= "0" && ch <= "9", "digit")
    const re = regex(/[0-9]+/)
    const md = many1(digit).map(ds => ds.join(""))
    bench("takeWhileChar1(isDigit)", () => tw.parseOrThrow(digits1k))
    bench("regex(/[0-9]+/)", () => re.parseOrThrow(digits1k))
    bench("many1(digit).join", () => md.parseOrThrow(digits1k))
  })
})

group("choice: choice() 4 alternatives, last matches", () => {
  const p = many(
    choice(literal("xx"), literal("yy"), literal("zz"), literal("abc"))
  )
  bench("choice(4) worst-case x2000", () => p.parseOrThrow(abcs))
})

group("sequence: generator vs zip chain", () => {
  summary(() => {
    const num = regex(/[0-9]+/).map(Number)
    const word = regex(/[a-z]+/)
    const genRow = parser(function* () {
      const a = yield* num
      yield* char(",")
      const b = yield* word
      yield* char(",")
      const c = yield* regex(/[0-9.]+/)
      yield* char(",")
      const d = yield* choice(literal("true"), literal("false"))
      return [a, b, c, d] as const
    })
    const zipRow = num
      .zipLeft(char(","))
      .zip(word.zipLeft(char(",")))
      .zip(regex(/[0-9.]+/).zipLeft(char(",")))
      .zip(choice(literal("true"), literal("false")))
    const genCsv = sepBy(genRow, char("\n"))
    const zipCsv = sepBy(zipRow, char("\n"))
    bench("generator rows (csv 1000 lines)", () =>
      genCsv.parseOrThrow(csvLines))
    bench("zip-chain rows (csv 1000 lines)", () =>
      zipCsv.parseOrThrow(csvLines))
  })
})

group("repetition: sepBy identifiers", () => {
  const ident = regex(/[a-z_][a-z0-9_]*/)
  const p = sepBy(ident, char(" "))
  bench("sepBy(ident, space) x2000", () => p.parseOrThrow(spacedWords))
})

group("failure path: choice with failing alternatives", () => {
  // Measures the cost of constructing errors that get discarded (backtracking)
  const p = many(
    choice(
      literal("nope1"),
      literal("nope2"),
      literal("nope3"),
      regex(/[a-z_0-9]+ ?/)
    )
  )
  bench("choice failure-heavy x2000", () => p.parseOrThrow(spacedWords + " "))
})

await run()
