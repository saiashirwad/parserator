import { describe, expect, test } from "vitest"
import { eof } from "../src/index.ts"
import { program as jsProgram } from "../examples/js-parser"
import { json } from "../examples/json-parser"
import {
  expr as toymlExpression,
  programParser as toymlProgram
} from "../examples/toyml/parser.ts"

describe("shipped examples", () => {
  test.each([
    "\n",
    " \n ",
    "\r",
    "\r\n",
    "\u2028",
    "\u2029",
    " /*\n*/ ",
    " // comment\r\n"
  ])("a return ends before a line break in %j", trivia => {
    expect(jsProgram.parseOrThrow(`return${trivia}value;`)).toEqual([
      { type: "return", value: undefined },
      { type: "expression", expression: { type: "identifier", name: "value" } }
    ])
    expect(jsProgram.parseOrThrow(`return${trivia};`)).toEqual([
      { type: "return", value: undefined }
    ])
  })

  test("a return accepts an expression after same-line trivia", () => {
    expect(jsProgram.parseOrThrow("return /* comment */ value;")).toEqual([
      { type: "return", value: { type: "identifier", name: "value" } }
    ])
    expect(jsProgram.parseOrThrow("return ;")).toEqual([
      { type: "return", value: undefined }
    ])
  })

  test("ToyML keeps identifiers that start with not intact", () => {
    expect(toymlExpression.parseOrThrow("notable")).toEqual({
      tag: "EVar",
      name: "notable"
    })
    expect(toymlExpression.parseOrThrow("not x")).toMatchObject({
      tag: "EPrefix",
      op: "not"
    })
  })

  test("ToyML accepts parenthesized operators, unit, and expressions", () => {
    expect(toymlExpression.parseOrThrow("(+)")).toEqual({
      tag: "EVar",
      name: "+"
    })
    expect(toymlExpression.parseOrThrow("()")).toEqual(
      toymlExpression.parseOrThrow("( )")
    )
    expect(toymlExpression.parseOrThrow("(x)")).toEqual({
      tag: "EVar",
      name: "x"
    })
    expect(toymlExpression.parse("(x +)").success).toBe(false)
  })

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

  test("the JavaScript example keeps compound assignments intact", () => {
    for (const operator of ["+=", "-=", "*=", "/="]) {
      expect(jsProgram.parseOrThrow(`x ${operator} 1;`)).toEqual([
        {
          type: "expression",
          expression: {
            type: "binary",
            op: operator,
            left: { type: "identifier", name: "x" },
            right: { type: "literal", value: 1 }
          }
        }
      ])
    }
  })

  test("the ToyML example accepts trailing list and record separators", () => {
    expect(toymlExpression.zipLeft(eof).parse("[1;]").success).toBe(true)
    expect(toymlExpression.zipLeft(eof).parse("{a = 1;}").success).toBe(true)
    expect(toymlProgram.parse("type r = { a: int; }").success).toBe(true)
  })
})
