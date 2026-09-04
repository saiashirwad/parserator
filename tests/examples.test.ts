import { describe, expect, test } from "vitest"
import { program as jsProgram } from "../examples/js-parser"
import { json } from "../examples/json-parser"

describe("shipped examples", () => {
  test("the JSON example enforces complete, strict JSON input", () => {
    expect(json.parse('{"ok": [true, null, 2]}').success).toBe(true)
    expect(json.parse("1 trailing").success).toBe(false)
    expect(json.parse(`"a${String.fromCharCode(0x0a)}b"`).success).toBe(false)
    expect(json.parse(`${String.fromCharCode(0x0b)}1`).success).toBe(false)
  })

  test("the JavaScript example applies binary precedence and left associativity", () => {
    expect(jsProgram.parseOrThrow("1 * 2 + 3;")).toEqual([
      {
        type: "expression",
        expression: {
          type: "binary",
          op: "+",
          left: {
            type: "binary",
            op: "*",
            left: { type: "literal", value: 1 },
            right: { type: "literal", value: 2 }
          },
          right: { type: "literal", value: 3 }
        }
      }
    ])

    expect(jsProgram.parseOrThrow("1 - 2 - 3;")).toEqual([
      {
        type: "expression",
        expression: {
          type: "binary",
          op: "-",
          left: {
            type: "binary",
            op: "-",
            left: { type: "literal", value: 1 },
            right: { type: "literal", value: 2 }
          },
          right: { type: "literal", value: 3 }
        }
      }
    ])
  })
})
