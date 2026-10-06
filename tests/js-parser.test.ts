import { describe, expect, test } from "vitest"
import { program } from "../examples/js-parser.ts"

describe("JavaScript parser", () => {
  test.each([
    ["42", 42],
    ["1.5e2", 150],
    ['"hello"', "hello"],
    ["'hello'", "hello"],
    ["true", true],
    ["false", false],
    ["null", null]
  ])("parses the literal %s", (source, value) => {
    expect(program.parseOrThrow(`${source};`)).toEqual([
      { type: "expression", expression: { type: "literal", value } }
    ])
  })

  test("parses nested expressions and shorthand properties", () => {
    expect(program.parseOrThrow("let result = {items: [1, x], x};")).toEqual([
      {
        type: "variable",
        kind: "let",
        name: "result",
        init: {
          type: "object",
          properties: [
            {
              key: "items",
              value: {
                type: "array",
                elements: [
                  { type: "literal", value: 1 },
                  { type: "identifier", name: "x" }
                ]
              }
            },
            { key: "x", value: { type: "identifier", name: "x" } }
          ]
        }
      }
    ])
  })

  test("chains calls and member access in source order", () => {
    expect(program.parseOrThrow("f(1).value();")).toEqual([
      {
        type: "expression",
        expression: {
          type: "call",
          callee: {
            type: "member",
            object: {
              type: "call",
              callee: { type: "identifier", name: "f" },
              args: [{ type: "literal", value: 1 }]
            },
            property: "value"
          },
          args: []
        }
      }
    ])
  })

  test("assignments associate to the right", () => {
    expect(program.parseOrThrow("x = y += 1;")).toEqual([
      {
        type: "expression",
        expression: {
          type: "binary",
          left: { type: "identifier", name: "x" },
          op: "=",
          right: {
            type: "binary",
            left: { type: "identifier", name: "y" },
            op: "+=",
            right: { type: "literal", value: 1 }
          }
        }
      }
    ])
  })

  test("parses function declarations and expressions with recursive bodies", () => {
    const body = [{ type: "return", value: { type: "identifier", name: "x" } }]
    expect(program.parseOrThrow("function identity(x) { return x; }")).toEqual([
      { type: "function", name: "identity", params: ["x"], body }
    ])
    expect(program.parseOrThrow("let f = function(x) { return x; };")).toEqual([
      {
        type: "variable",
        kind: "let",
        name: "f",
        init: { type: "function", params: ["x"], body }
      }
    ])
  })

  test("attaches else to the nearest if", () => {
    expect(program.parseOrThrow("if (x) if (y) a; else b;")).toEqual([
      {
        type: "if",
        test: { type: "identifier", name: "x" },
        consequent: {
          type: "if",
          test: { type: "identifier", name: "y" },
          consequent: {
            type: "expression",
            expression: { type: "identifier", name: "a" }
          },
          alternate: {
            type: "expression",
            expression: { type: "identifier", name: "b" }
          }
        },
        alternate: undefined
      }
    ])
  })

  test.each([
    ["1 = 2;", "Invalid assignment target"],
    ["const x;", "Missing initializer in const declaration"],
    ["x = ;", "expression after assignment operator"],
    ["let x = [1;", "Expected end of input, found l"],
    ["let x = {a: 1;", "Expected end of input, found l"]
  ])("preserves the diagnostic for %s", (source, message) => {
    expect(() => program.parseOrThrow(source)).toThrow(message)
  })
})
