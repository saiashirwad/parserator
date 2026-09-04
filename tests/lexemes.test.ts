import { describe, expect, test } from "vitest"
import { createLexemes, fatal, literal, regex } from "../src/index.ts"

describe("createLexemes", () => {
  test.each([
    [/[A-Za-z_][A-Za-z0-9_.]*/, "AND.owner"],
    [/[A-Za-z_][A-Za-z0-9_-]*/, "AND-owner"],
    [/\p{L}[\p{L}\p{N}_]*/u, "ANDé"]
  ])(
    "uses the configured identifier parser for keyword boundaries",
    (identifier, input) => {
      const lex = createLexemes({
        trivia: regex(/\s*/),
        identifier: regex(identifier),
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
      identifier: regex(/[A-Z]+/),
      keywords: ["AND"] as const
    })

    expect(lex.keyword("AND").parsePrefix("AND1")).toEqual({
      success: true,
      value: { value: "AND", offset: 3, rest: "1" }
    })
  })

  test("uses configured keyword boundaries when checking complete input", () => {
    const lex = createLexemes({
      trivia: regex(/\s*/),
      identifier: regex(/[A-Za-z_][A-Za-z0-9_.]*/),
      keywords: ["AND"] as const
    })

    const keyword = lex.complete(literal("x")).parse("x AND")
    expect(keyword.success).toBe(false)
    if (!keyword.success) {
      expect(keyword.error.diagnostic.message).toContain(
        "Unexpected trailing keyword"
      )
    }

    const identifier = lex.complete(literal("x")).parse("x AND.owner")
    expect(identifier.success).toBe(false)
    if (!identifier.success) {
      expect(identifier.error.diagnostic.message).not.toBe(
        'Unexpected trailing keyword "AND"'
      )
    }
  })

  test("does not hide fatal identifier failures during a boundary check", () => {
    const lex = createLexemes({
      trivia: regex(/\s*/),
      identifier: fatal("identifier boundary failed"),
      keywords: ["AND"] as const
    })
    const result = lex.keyword("AND").parse("AND")

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.diagnostic.kind).toBe("fatal")
      expect(result.error.diagnostic.message).toBe("identifier boundary failed")
    }
  })

  test("keeps typo hints when no keyword prefix matches", () => {
    const lex = createLexemes({
      trivia: regex(/\s*/),
      identifier: regex(/[A-Za-z_][A-Za-z0-9_.]*/),
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
      identifier: regex(/[A-Za-z]+/),
      keywords: ["AND"] as const
    })
    const result = lex.keyword("AND").parse("ANDS")

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.diagnostic.hints).toContain("AND")
  })
})
