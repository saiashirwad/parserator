import { describe, expect, test } from "vitest"
import { char } from "../src/combinators"
import { ParseError, ParseErrorBundle, Span } from "../src/errors"

describe("ParseErrorBundle", () => {
  test("is an Error subclass with a name", () => {
    const bundle = new ParseErrorBundle(
      [
        ParseError.expected({
          span: Span({ offset: 0, line: 1, column: 1 }),
          items: ["a"],
          context: []
        })
      ],
      "b"
    )
    expect(bundle instanceof Error).toBe(true)
    expect(bundle instanceof ParseErrorBundle).toBe(true)
    expect(bundle.name).toBe("ParseErrorBundle")
  })

  test("parseOrThrow throws a real Error with a stack", () => {
    try {
      char("a").parseOrThrow("b")
      expect.unreachable("parseOrThrow should have thrown")
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(ParseErrorBundle)
      expect((error as ParseErrorBundle).name).toBe("ParseErrorBundle")
      expect(typeof (error as Error).stack).toBe("string")
      expect((error as Error).stack!.length).toBeGreaterThan(0)
    }
  })
})
