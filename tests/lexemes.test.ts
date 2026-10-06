import { describe, expect, test } from "vitest"
import { createLexemes, literal, regex } from "../src/index.ts"

describe("createLexemes", () => {
  test("reserved-word errors cover the identifier before trailing trivia", () => {
    const lex = createLexemes({
      trivia: regex(/\s*/),
      identifier: /[A-Za-z]+/,
      keywords: ["AND"] as const
    })
    const result = lex.complete(lex.identifier).parse("  AND \n next")
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.diagnostic.span).toEqual({ start: 2, end: 5 })
    expect(result.error.diagnostic).toMatchObject({
      kind: "custom",
      message: '"AND" is a reserved keyword'
    })
    expect(result.error.format()).toContain("line 1, column 3")
  })

  test.each([
    [/[A-Za-z_][A-Za-z0-9_.]*/, "AND.owner"],
    [/[A-Za-z_][A-Za-z0-9_-]*/, "AND-owner"],
    [/\p{L}[\p{L}\p{N}_]*/u, "ANDé"]
  ])(
    "uses the configured identifier parser for keyword boundaries",
    (identifier, input) => {
      const lex = createLexemes({
        trivia: regex(/\s*/),
        identifier,
        keywords: ["AND"] as const
      })

      expect(lex.identifier.parse(input)).toEqual({
        success: true,
        value: input
      })
      expect(lex.keyword("AND").parsePrefix(input).success).toBe(false)
    }
  )

  test("accepts a keyword before a character excluded from identifiers", () => {
    const lex = createLexemes({
      trivia: regex(/\s*/),
      identifier: /[A-Z]+/,
      keywords: ["AND"] as const
    })

    expect(lex.keyword("AND").parsePrefix("AND1")).toEqual({
      success: true,
      value: "AND",
      offset: 3,
      rest: "1"
    })
  })

  test("uses configured keyword boundaries when checking complete input", () => {
    const lex = createLexemes({
      trivia: regex(/\s*/),
      identifier: /[A-Za-z_][A-Za-z0-9_.]*/,
      keywords: ["AND"] as const
    })

    const keyword = lex.complete(literal("x")).parse("x AND")
    expect(keyword.success).toBe(false)
    if (!keyword.success) {
      expect(keyword.error.diagnostic).toMatchObject({
        kind: "expected",
        expected: ["end of input"]
      })
    }

    const identifier = lex.complete(literal("x")).parse("x AND.owner")
    expect(identifier.success).toBe(false)
    if (!identifier.success) {
      expect(identifier.error.diagnostic).not.toHaveProperty("message")
    }
  })

  test("rejects empty identifiers and invalid keyword configurations", () => {
    expect(() =>
      createLexemes({ trivia: regex(/\s*/), identifier: /a*/, keywords: [] })
    ).toThrow(/consume input/)
    expect(() =>
      createLexemes({
        trivia: regex(/\s*/),
        identifier: /[A-Z]+/,
        keywords: ["AND-OR"]
      })
    ).toThrow(/complete identifier/)
  })

  test("keeps typo hints when no keyword prefix matches", () => {
    const lex = createLexemes({
      trivia: regex(/\s*/),
      identifier: /[A-Za-z_][A-Za-z0-9_.]*/,
      keywords: ["AND"] as const
    })
    const result = lex.keyword("AND").parse("AN")

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.diagnostic.hints).toContain("AND")
  })

  test("keeps typo hints when an identifier extends a keyword", () => {
    const lex = createLexemes({
      trivia: regex(/\s*/),
      identifier: /[A-Za-z]+/,
      keywords: ["AND"] as const
    })
    const result = lex.keyword("AND").parse("ANDS")

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.diagnostic.hints).toContain("AND")
  })
})
