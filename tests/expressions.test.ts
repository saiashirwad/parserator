import { describe, expect, test } from "vitest"
import {
  chainLeft1,
  chainRight1,
  choice,
  commit,
  fail,
  fatal,
  literal,
  precedence,
  regex,
  succeed
} from "../src/index.ts"

const number = regex(/[0-9]+/).map(Number)
const subtract = literal("-").map(() => (a: number, b: number) => a - b)

describe("expression chains", () => {
  test("precedence accepts composed operators and both associativities", () => {
    for (const [associativity, expected] of [
      ["left", 12],
      ["right", 16]
    ] as const) {
      const expression = precedence(number, [
        {
          associativity: "left",
          operator: literal("*").map(() => (a: number, b: number) => a * b)
        },
        {
          associativity,
          operator: choice(
            subtract,
            literal("+").map(() => (a: number, b: number) => a + b)
          )
        }
      ])
      expect(expression.parseOrThrow("20-2*3-2")).toBe(expected)
    }
    expect(precedence(number, []).parseOrThrow("42")).toBe(42)
  })

  test("right chains are iterative", () => {
    const add = literal("+").map(() => (a: number, b: number) => a + b)
    expect(
      chainRight1(number, add).parseOrThrow(Array(20000).fill("1").join("+"))
    ).toBe(20000)
  })

  for (const chain of [chainLeft1, chainRight1]) {
    test(`${chain.name} requires a right operand`, () => {
      const result = chain(number, subtract).parse("1-")
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.diagnostic.span.start).toBe(2)
    })

    test(`${chain.name} propagates cut and fatal operator failures`, () => {
      for (const operator of [
        commit().zipRight(fail("operator")),
        fatal("operator")
      ]) {
        expect(
          choice(chain(number, operator), succeed(99)).parsePrefix("1").success
        ).toBe(false)
      }
      expect(chain(number, subtract).parsePrefix("1!")).toMatchObject({
        success: true,
        value: 1,
        rest: "!"
      })
    })

    test(`${chain.name} rejects non-consuming cycles`, () => {
      expect(() =>
        chain(
          succeed(1),
          succeed((a: number, b: number) => a + b)
        ).parse("")
      ).toThrow("must consume input")
    })
  }
})
