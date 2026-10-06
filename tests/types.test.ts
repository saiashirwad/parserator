import { describe, expect, test } from "vitest"
import {
  char,
  choice,
  digit,
  literal,
  parser,
  position,
  sequence,
  type Parser
} from "../src/index"
import type { Diagnostic, ParseResult, SourcePosition } from "../src/index"
import {
  makeParser,
  replyFailure,
  replySuccess,
  runParser,
  SourceText,
  type Reply
} from "../src/advanced.ts"

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
  const value: "ok" = parsePrefixResult.value
  void value
  const offset: number = parsePrefixResult.offset
  const rest: string = parsePrefixResult.rest
  void offset
  void rest
}

const opaqueCheck = () => {
  // @ts-expect-error A structural method bag cannot manufacture a nominal parser.
  const forged: Parser<string> = { map: () => literal("x") }
  // @ts-expect-error Parsers must never be Promise thenables.
  literal("x").then(() => 1)
  void forged
}
void opaqueCheck

// The implementation constructor is intentionally not part of the public API.
const assertNotConstructible = () => {
  // @ts-expect-error Parser values must come from parser/combinator factories.
  new Parser(() => {
    throw new Error("not a public parser construction path")
  })
}
void assertNotConstructible

const advanced = makeParser((source, offset) =>
  source.charAt(offset) === "x"
    ? replySuccess(42 as const, offset + 1)
    : replyFailure(
        {
          kind: "expected",
          expected: ["x"],
          span: { start: offset, end: offset }
        },
        offset
      )
)
const advancedReply: Reply<42> = runParser(advanced, new SourceText("x"), 0)
void advancedReply
const requiredDiagnosticPayloads = () => {
  // @ts-expect-error Expected diagnostics must carry expectations.
  const expected: Diagnostic = { kind: "expected", span: { start: 0, end: 0 } }
  // @ts-expect-error Unexpected diagnostics must identify the found input.
  const unexpected: Diagnostic = {
    kind: "unexpected",
    span: { start: 0, end: 0 }
  }
  // @ts-expect-error Custom diagnostics must have a message.
  const custom: Diagnostic = { kind: "custom", span: { start: 0, end: 0 } }
  const fatal: Diagnostic = {
    // @ts-expect-error Fatality belongs to reply control, not diagnostic kind.
    kind: "fatal",
    message: "broken",
    span: { start: 0, end: 0 }
  }
  // @ts-expect-error Construction no longer accepts a state-based runner.
  makeParser((state: { source: string; offset: number }) =>
    replySuccess(state.source, state.offset)
  )
  void [expected, unexpected, custom, fatal]
}
void requiredDiagnosticPayloads

describe("type assertions", () => {
  test("the compile-time assertions above are checked by tsc", () => {
    expect(true).toBe(true)
  })
})
