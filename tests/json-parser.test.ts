import { describe, expect, test } from "vitest"
import { json } from "../examples/json-parser.ts"

describe("JSON parser", () => {
  test.each([
    ["null", null],
    ["true", true],
    ["false", false],
    ["-1.25e2", -125],
    ['"hello"', "hello"],
    ['"\\\"\\\\\\/\\b\\f\\n\\r\\t"', '"\\/\b\f\n\r\t'],
    ['"\\u0041\\u2028\\ud800"', "A\u2028\ud800"],
    ["[]", []],
    ["{}", {}],
    [
      '{"items": [1, true, null, {"name": "x"}]}',
      { items: [1, true, null, { name: "x" }] }
    ]
  ])("parses %s", (source, expected) => {
    expect(json.parseOrThrow(` \t${source}\r\n`)).toEqual(expected)
  })

  test("the last value wins for a duplicate object key", () => {
    expect(json.parseOrThrow('{"x": 1, "x": 2}')).toEqual({ x: 2 })
  })

  test.each([
    "01",
    "1.",
    "1e+",
    "+1",
    "NaN",
    "[1,]",
    '{"x": 1,}',
    '"unterminated',
    '"\\x"',
    '"a\nb"',
    "\u000b1",
    "1 trailing"
  ])("rejects %j", source => {
    expect(json.parse(source).success).toBe(false)
  })

  test("an invalid escape reports the escaped character", () => {
    const result = json.parse('"\\x"')
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.toJSON()).toEqual({
      kind: "expected",
      span: { start: 2, end: 3 },
      expected: ["/u[0-9a-fA-F]{4}/", '/["\\\\/bfnrt]/'],
      found: "x",
      fatal: false
    })
  })
})
