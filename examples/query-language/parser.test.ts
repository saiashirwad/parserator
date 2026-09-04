import { describe, expect, test } from "vitest"
import { createLexemes, literal, ParseError, regex } from "../../src/index.ts"
import { evaluate } from "./evaluate.ts"
import { query, queryLexemes } from "./parser.ts"

describe("query language", () => {
  test("parses AND and OR with AND precedence", () => {
    const ast = query.parseOrThrow(
      "status:open AND (owner:me OR priority >= 3)"
    )
    expect(evaluate(ast, { status: "open", owner: "me", priority: 1 })).toBe(
      true
    )
    expect(evaluate(ast, { status: "closed", owner: "me", priority: 4 })).toBe(
      false
    )
    expect(evaluate(ast, { status: "open", owner: "other", priority: 3 })).toBe(
      true
    )
  })

  test("gives AND higher precedence than OR without parentheses", () => {
    const ast = query.parseOrThrow("status:open OR owner:me AND priority >= 3")

    expect(ast).toEqual({
      type: "logical",
      operator: "OR",
      left: {
        type: "comparison",
        field: "status",
        operator: ":",
        value: "open"
      },
      right: {
        type: "logical",
        operator: "AND",
        left: {
          type: "comparison",
          field: "owner",
          operator: ":",
          value: "me"
        },
        right: {
          type: "comparison",
          field: "priority",
          operator: ">=",
          value: 3
        }
      }
    })
  })

  test.each([
    ["version:123abc", "123abc"],
    ["path:2026/09", "2026/09"],
    ["version:1.2.3", "1.2.3"]
  ])("keeps a digit-leading bare value in %s as text", (input, expected) => {
    expect(query.parseOrThrow(input)).toMatchObject({ value: expected })
  })

  test("rejects keyword prefixes as identifiers", () => {
    const result = query.parse("status:open ANDY owner:me")
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.diagnostic.span.start).toBe(
      "status:open ANDY owner:me".indexOf("ANDY")
    )
  })

  test("reports a typo at AN and suggests AND", () => {
    const input = "status:open AN owner:me"
    const result = query.parse(input)
    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error.diagnostic.span.start).toBe(input.indexOf("AN"))
    expect(result.error.diagnostic.hints).toContain("AND")
  })

  test("suggests AND for the typo AN", () => {
    const result = queryLexemes.keyword("AND").parse("AN")
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.diagnostic.hints).toContain("AND")
  })

  test("reports a structured malformed operand", () => {
    const result = query.parse("status:open AND owner:")
    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error).toBeInstanceOf(ParseError)
    expect(result.error.diagnostic).toMatchObject({
      kind: "expected",
      expected: ["query value"],
      context: ["comparison"]
    })
    expect(result.error.diagnostic.span.start).toBe(
      "status:open AND owner:".length
    )
    expect(result.error.format({ style: "plain" })).toContain(
      "Expected query value"
    )
    expect(result.error.format({ style: "plain" })).toContain(
      "While parsing: comparison"
    )
    expect(result.error.toJSON()).toMatchObject({
      kind: "expected",
      expected: ["query value"],
      context: ["comparison"]
    })
  })

  test("reports an unclosed parenthesized expression", () => {
    const result = query.parse("status:open AND (owner:me")
    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error).toBeInstanceOf(ParseError)
    expect(result.error.diagnostic).toMatchObject({
      kind: "expected",
      expected: ["closing delimiter"],
      context: ["parenthesized expression"]
    })
    expect(result.error.diagnostic.span.start).toBe(
      "status:open AND (owner:me".length
    )
    expect(result.error.format({ style: "plain" })).toContain(
      "Expected closing delimiter"
    )
    expect(result.error.format({ style: "plain" })).toContain(
      "While parsing: parenthesized expression"
    )
  })

  test("requires complete input", () => {
    expect(query.parse("status:open trailing").success).toBe(false)
  })

  test("keeps inner context for trailing-input failures", () => {
    const lex = createLexemes({
      trivia: regex(/[ ]*/),
      identifier: regex(/[A-Za-z]+/),
      keywords: [] as const
    })
    const result = lex.complete(literal("a").context("inner")).parse("a b")
    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error.diagnostic.context).toContain("inner")
  })
})
