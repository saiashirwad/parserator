import { expect, test } from "vitest"
import {
  anyKeywordWithHints,
  createLexemes,
  fail,
  literal,
  notFollowedBy,
  regex,
  stringWithHints
} from "../src/index.ts"
import { diagnosticMessage, type Diagnostic } from "../src/errors.ts"
import { mergeDiagnostics } from "../src/diagnostic-merge.ts"

test("an empty custom message wins tied expectations without being rewritten", () => {
  const expected: Diagnostic = {
    kind: "expected",
    expected: ["token"],
    span: { start: 0, end: 1 }
  }
  const custom: Diagnostic = {
    kind: "custom",
    message: "",
    span: { start: 0, end: 0 }
  }
  expect(mergeDiagnostics([expected, custom])).toEqual(custom)
  expect(mergeDiagnostics([custom, expected])).toEqual(custom)
  expect(diagnosticMessage(custom)).toBe("")
  const result = fail("").parse("")
  if (result.success) throw new Error("expected failure")
  expect(result.error.message).toBe("")
})

test("direct diagnostic merging retains first-seen expectations and deepest context", () => {
  const merged = mergeDiagnostics([
    {
      kind: "expected",
      expected: ["a", "b"],
      span: { start: 2, end: 3 },
      hints: ["alpha"]
    },
    {
      kind: "expected",
      expected: ["b", "c"],
      span: { start: 2, end: 4 },
      context: ["inner"],
      hints: ["beta"]
    },
    { kind: "custom", message: "earlier", span: { start: 1, end: 5 } }
  ])
  expect(merged).toEqual({
    kind: "expected",
    expected: ["a", "b", "c"],
    span: { start: 2, end: 4 },
    context: ["inner"],
    hints: ["alpha", "beta"]
  })
})

test("a tied explicit rejection outranks expectations but not a custom diagnostic", () => {
  const expected: Diagnostic = {
    kind: "expected",
    expected: ["b"],
    span: { start: 0, end: 2 }
  }
  const unexpected: Diagnostic = {
    kind: "unexpected",
    found: "😀",
    span: { start: 0, end: 0 }
  }
  const custom: Diagnostic = {
    kind: "custom",
    message: "",
    span: { start: 0, end: 1 }
  }
  expect(mergeDiagnostics([expected, unexpected])).toEqual(unexpected)
  expect(mergeDiagnostics([unexpected, expected])).toEqual(unexpected)
  expect(mergeDiagnostics([unexpected, custom, expected])).toEqual(custom)
})

test("expected conversion removes the custom-only message payload", () => {
  const result = fail("custom text")
    .context("value")
    .expected("token")
    .parse("")
  if (result.success) throw new Error("expected failure")
  expect(result.error.diagnostic).toEqual({
    kind: "expected",
    expected: ["token"],
    span: { start: 0, end: 0 },
    context: ["value"]
  })
  expect(result.error.message).toBe("Expected token")
})

test("empty keyword alternatives fail at construction but empty lexical vocabulary is valid", () => {
  expect(() => anyKeywordWithHints([])).toThrow(/at least one/)
  const lex = createLexemes({ trivia: regex(/\s*/), identifier: /[a-z]+/ })
  expect(lex.complete(lex.identifier).parseOrThrow(" name ")).toBe("name")
})

test("expected and unexpected messages are derived only from their own payloads", () => {
  const quoted = stringWithHints(["name"]).parse('"name')
  if (quoted.success) throw new Error("expected failure")
  expect(quoted.error.message).toBe("Expected closing quote")
  expect(quoted.error.diagnostic).not.toHaveProperty("message")
  const following = notFollowedBy(literal("x")).parse("x")
  if (following.success) throw new Error("expected failure")
  expect(following.error.message).toBe("Unexpected x")
  expect(following.error.diagnostic).not.toHaveProperty("message")
})
