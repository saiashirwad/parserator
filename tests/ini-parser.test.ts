import { describe, expect, test } from "vitest"
import { iniFile } from "../examples/ini-parser.ts"

describe("INI parser", () => {
  test.each(["\n", "\r", "\r\n"])(
    "parses sections separated by %j",
    newline => {
      const source = [
        "; header comment",
        "[ first ]",
        " key.name-1 = value ",
        "# property comment",
        "empty =",
        " \t",
        "[second]",
        "enabled=yes"
      ].join(newline)
      expect(iniFile.parseOrThrow(source)).toEqual([
        {
          name: "first",
          properties: [
            { key: "key.name-1", value: "value" },
            { key: "empty", value: "" }
          ]
        },
        { name: "second", properties: [{ key: "enabled", value: "yes" }] }
      ])
    }
  )

  test("preserves duplicate properties and comment characters in values", () => {
    expect(
      iniFile.parseOrThrow("[a]\nx=first # value\nx=second; value")
    ).toEqual([
      {
        name: "a",
        properties: [
          { key: "x", value: "first # value" },
          { key: "x", value: "second; value" }
        ]
      }
    ])
  })

  test.each(["", " \t\r\n; comment\n# another"])(
    "accepts empty input %j",
    source => {
      expect(iniFile.parseOrThrow(source)).toEqual([])
    }
  )

  test.each(["[broken", "[]", "x=1", "[a]\nx", "[a]\n=1"])(
    "rejects %j",
    source => {
      expect(iniFile.parse(source).success).toBe(false)
    }
  )

  test("a malformed property retains the end-of-input diagnostic", () => {
    const result = iniFile.parse("[a]\nx")
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.toJSON()).toEqual({
      kind: "expected",
      span: { start: 4, end: 5 },
      expected: ["end of input"],
      found: "x",
      fatal: false
    })
  })
})
