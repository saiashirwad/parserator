import { describe, expect, test } from "vitest"
import {
  char,
  choice,
  digit,
  literal,
  parser,
  position,
  sequence,
  Parser
} from "../src/index"
import type { ParseResult, SourcePosition } from "../src/index"

// This file is included by the repository's strict tsc check. The assignments
// below are compile-time assertions; `void` keeps the assertion values live
// without adding runtime tests.

const literalResult: ParseResult<"let"> = literal("let").parse("let")
const parsedPosition: SourcePosition = position.parseOrThrow("")
void parsedPosition
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

const incremental: import("../src/index").IncrementalParser<"ok"> =
  literal("ok").incremental()
const incrementalResult: import("../src/index").IncrementalResult<"ok"> =
  incremental.push("o")
if (incrementalResult.status === "done") {
  const value: "ok" = incrementalResult.value
  const rest: string = incrementalResult.rest
  void [value, rest]
}
incremental.cancel()
const messages: AsyncGenerator<"ok"> = literal("ok").stream(["ok"])
void messages
const promised: AsyncGenerator<number> = literal("ok")
  .map(async () => 1)
  .stream(["ok"])
void promised
const binaryTypes = async () => {
  const { uint8 } = await import("../src/binary/index.ts")
  const session: import("../src/binary/index.ts").BinaryIncrementalParser<number> =
    uint8.incremental()
  const result: import("../src/binary/index.ts").BinaryIncrementalResult<number> =
    session.push(new Uint8Array([1]))
  if (result.status === "done") {
    const rest: Uint8Array = result.rest
    void rest
  }
  // @ts-expect-error Binary sessions accept byte arrays, not strings.
  session.push("x")
}
void binaryTypes

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
