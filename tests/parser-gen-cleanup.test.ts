import { describe, expect, test } from "vitest"
import { char, parser } from "../src"
import { Either } from "../src/either"

describe("Parser.gen closes the generator on failure", () => {
  test("try/finally runs when an inner parser fails", () => {
    let cleaned = false
    const p = parser(function* () {
      try {
        yield* char("a")
        yield* char("b")
        return "ok"
      } finally {
        cleaned = true
      }
    })

    const { result } = p.parse("ax")
    expect(Either.isLeft(result)).toBe(true)
    expect(cleaned).toBe(true)
  })

  test("try/finally still runs on success", () => {
    let cleaned = false
    const p = parser(function* () {
      try {
        const a = yield* char("a")
        return a
      } finally {
        cleaned = true
      }
    })

    expect(p.parseOrThrow("a")).toBe("a")
    expect(cleaned).toBe(true)
  })
})
