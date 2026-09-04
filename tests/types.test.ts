import { describe, expect, test } from "vitest"
import {
  char,
  choice,
  digit,
  literal,
  parser,
  sequence,
  Parser
} from "../src/index"
import type { ParseResult } from "../src/index"

// This file is included by the repository's strict tsc check. The assignments
// below are compile-time assertions; `void` keeps the assertion values live
// without adding runtime tests.

const literalResult: ParseResult<"let"> = literal("let").parse("let")
if (literalResult.success) {
  const value: "let" = literalResult.value
  void value
} else {
  const error = literalResult.error
  void error
}

const tupleResult = sequence([literal("("), digit, literal(")")]).parse("(1)")
if (tupleResult.success) {
  const value: ["(", string, ")"] = tupleResult.value
  void value
}

const choiceResult = choice(literal("yes"), literal("no")).parse("yes")
if (choiceResult.success) {
  const value: "yes" | "no" = choiceResult.value
  void value
}

const generatorParser = parser(function* () {
  const left = yield* char("<")
  const value = yield* digit
  const right = yield* char(">")
  return { left, value, right }
})

const generatorResult = generatorParser.parse("<1>")
if (generatorResult.success) {
  const value: { left: "<"; value: string; right: ">" } = generatorResult.value
  void value
}

const parsePrefixResult = literal("ok").parsePrefix("ok!")
if (parsePrefixResult.success) {
  const offset: number = parsePrefixResult.value.offset
  const rest: string = parsePrefixResult.value.rest
  void offset
  void rest
}

// The implementation constructor is intentionally not part of the public API.
const assertNotConstructible = () => {
  // @ts-expect-error Parser values must come from parser/combinator factories.
  new Parser(() => {
    throw new Error("not a public parser construction path")
  })
}
void assertNotConstructible

describe("type assertions", () => {
  test("the compile-time assertions above are checked by tsc", () => {
    expect(true).toBe(true)
  })
})
