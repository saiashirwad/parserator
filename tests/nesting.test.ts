import { describe, expect, test } from "vitest"
import {
  choice,
  literal,
  parser,
  ParseError,
  recursive,
  regex,
  type Parser
} from "../src/index.ts"

const nested = (depth: number) => "(".repeat(depth) + "1" + ")".repeat(depth)

const generated: Parser<unknown> = parser(function* () {
  return yield* choice(
    parser(function* () {
      yield* literal("(")
      const inner = yield* generated
      yield* literal(")")
      return [inner]
    }),
    regex(/\d+/)
  )
})

const combined: Parser<unknown> = recursive(self =>
  choice(literal("(").zipRight(self).zipLeft(literal(")")), regex(/\d+/))
)

describe("input nested deeper than the call stack", () => {
  test("a generator parser fails fatally where the nesting got too deep", () => {
    const input = nested(50_000)
    const result = generated.parse(input)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.fatal).toBe(true)
    expect(result.error.message).toContain("input nests too deeply to parse")
    expect(result.error.diagnostic.span.start).toBeGreaterThan(0)
    expect(input[result.error.diagnostic.span.start - 1]).toBe("(")
  })

  test("a combinator-only parser fails at the start of the input", () => {
    const result = combined.parsePrefix(nested(50_000))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.fatal).toBe(true)
    expect(result.error.diagnostic.span).toEqual({ start: 0, end: 0 })
  })

  test("parseOrThrow throws a ParseError, not a RangeError", () => {
    expect(() => generated.parseOrThrow(nested(50_000))).toThrow(ParseError)
  })

  test("shallow nesting still parses", () => {
    expect(generated.parse(nested(100)).success).toBe(true)
    expect(combined.parse(nested(100)).success).toBe(true)
  })

  test("other RangeErrors from user code still propagate", () => {
    const broken = parser(function* () {
      yield* literal("a")
      throw new RangeError("out of range")
    })
    expect(() => broken.parse("a")).toThrow("out of range")
    expect(() =>
      literal("a")
        .map(() => [].length.toFixed(-1))
        .parse("a")
    ).toThrow(RangeError)
  })
})
