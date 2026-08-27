import { describe, expect, test } from "vitest"
import { char, commit, or, parser, regex, string } from "../src"
import { Either } from "../src/either"

describe("label preserves committed", () => {
  test("committed labeled alternative in or() does not fall through", () => {
    // README letExpr.label pitfall: wrapping a committed rule in .label()
    // used to rewind to the entry state and drop `committed`, so `or`
    // would try the next branch and succeed with the wrong parse.
    const name = regex(/[a-z]+/)
    const number = regex(/-?\d+/).map(Number)

    const letExpr = parser(function* () {
      yield* string("let")
      yield* char(" ")
      yield* commit()
      const n = yield* name
      yield* char("=")
      const value = yield* number
      return { type: "let" as const, name: n, value }
    }).label("let expression")

    const variable = name.map(n => ({ type: "var" as const, name: n }))
    const expr = or(letExpr, variable)

    const { result } = expr.parse("let x 42")
    expect(Either.isLeft(result)).toBe(true)
  })

  test("uncommitted labeled alternative still backtracks", () => {
    const p = or(string("foo").label("foo"), string("bar"))
    expect(p.parseOrThrow("bar")).toBe("bar")
  })
})
