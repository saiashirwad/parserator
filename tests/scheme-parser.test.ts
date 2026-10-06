import { describe, expect, test } from "vitest"
import {
  expr,
  LispExpr,
  lispParser,
  program
} from "../examples/scheme-parser.ts"
import { attempt, choice, literal } from "../src/index.ts"

describe("Scheme parser", () => {
  test.each([
    ["name", { type: "Symbol", name: "name" }],
    ["#", { type: "Symbol", name: "#" }],
    ["-", { type: "Symbol", name: "-" }],
    ["-12.5", { type: "Number", value: -12.5 }],
    ['"hello"', { type: "String", value: "hello" }],
    ["#t", { type: "Boolean", value: true }],
    ["#f", { type: "Boolean", value: false }]
  ])("parses atom %s", (source, value) => {
    expect(expr.parseOrThrow(source)).toEqual(value)
    expect(lispParser.parseOrThrow(source)).toEqual(value)
  })

  test("preserves nested special forms, lists, and comments", () => {
    expect(
      lispParser.parseOrThrow(
        "; before\n(let ((x 1)) (if #t (lambda (y) (+ x y)) x)) ; after"
      )
    ).toEqual({
      type: "Let",
      bindings: [{ name: "x", value: { type: "Number", value: 1 } }],
      body: {
        type: "If",
        condition: { type: "Boolean", value: true },
        consequent: {
          type: "Lambda",
          params: ["y"],
          body: {
            type: "List",
            items: ["+", "x", "y"].map(name => ({ type: "Symbol", name }))
          }
        },
        alternate: { type: "Symbol", name: "x" }
      }
    })
  })

  test("parses multiple expressions without requiring token boundaries", () => {
    expect(program.parseOrThrow('1abc #true ; comment\n"s"')).toEqual([
      LispExpr.number(1),
      LispExpr.symbol("abc"),
      LispExpr.bool(true),
      LispExpr.symbol("rue"),
      LispExpr.string("s")
    ])
  })

  test("keeps constructors available with their specific AST types", () => {
    const symbol: LispExpr.Symbol = LispExpr.symbol("x")
    const number: LispExpr.Number = LispExpr.number(1)
    const string: LispExpr.String = LispExpr.string("s")
    const boolean: LispExpr.Boolean = LispExpr.bool(true)
    const list: LispExpr.List = LispExpr.list([symbol])
    const conditional: LispExpr.If = LispExpr.if(boolean, number, string)
    const lambda: LispExpr.Lambda = LispExpr.lambda(["x"], symbol)
    const binding: LispExpr.Let = LispExpr.let(
      [{ name: "x", value: number }],
      list
    )
    expect(
      [symbol, number, string, boolean, list, conditional, lambda, binding].map(
        node => node.type
      )
    ).toEqual([
      "Symbol",
      "Number",
      "String",
      "Boolean",
      "List",
      "If",
      "Lambda",
      "Let"
    ])
  })

  test.each([
    ["()", "Empty list not allowed", 2],
    ["(lambda () x)", "Empty list not allowed", 10],
    [
      "(if x y)",
      "If requires exactly 4 elements: (if condition consequent alternate)",
      8
    ],
    [
      "(lambda x)",
      "Lambda requires exactly 3 elements: (lambda (params...) body)",
      10
    ],
    ["(lambda 1 x)", "Lambda parameters must be a list", 12],
    ["(lambda (1) x)", "Lambda parameters must be symbols", 14],
    [
      "(let x)",
      "Let requires exactly 3 elements: (let ((var val)...) body)",
      7
    ],
    ["(let x y)", "Let bindings must be a list", 9],
    [
      "(let (x) y)",
      "Each let binding must be a list of exactly 2 elements",
      11
    ],
    [
      "(let ((x)) y)",
      "Each let binding must be a list of exactly 2 elements",
      13
    ],
    ["(let ((1 2)) y)", "Let binding name must be a symbol", 15]
  ])("preserves special-form validation for %s", (source, message, offset) => {
    const result = lispParser.parse(source)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.toJSON()).toEqual({
      kind: "custom",
      span: { start: offset, end: offset },
      message,
      fatal: true
    })
  })

  test.each([
    ["(", 1, 1, ["closing parenthesis ')'"], undefined],
    ["(x", 2, 2, ["closing parenthesis ')'"], undefined],
    ['"abc', 4, 4, ["closing quote for string literal"], undefined],
    ["1.", 1, 2, ["end of input"], "."],
    ["x y", 2, 3, ["end of input"], "y"]
  ])(
    "preserves syntax diagnostics for %s",
    (source, start, end, expected, found) => {
      const result = lispParser.parse(source)
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.toJSON()).toEqual({
        kind: "expected",
        span: { start, end },
        expected,
        ...(found === undefined ? {} : { found }),
        fatal: false
      })
    }
  )

  test("preserves atom diagnostic ordering and context", () => {
    const result = expr.parse("")
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.toJSON()).toEqual({
      kind: "expected",
      span: { start: 0, end: 0 },
      expected: ['"#t"', '"#f"', "digit in number", '"\\\""', "/[^()\\s;]+/"],
      context: ["boolean"],
      fatal: false
    })
  })

  test("keeps list attempt distinct from committed strings and fatal validation", () => {
    expect(choice(expr, literal("(")).parseOrThrow("(")).toBe("(")
    expect(choice(expr, literal('"')).parse('"').success).toBe(false)
    expect(choice(attempt(expr), literal('"')).parseOrThrow('"')).toBe('"')
    expect(choice(attempt(expr), literal("()")).parse("()").success).toBe(false)
    const result = program.parse("(")
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.toJSON()).toEqual({
      kind: "expected",
      span: { start: 0, end: 1 },
      expected: ["end of input"],
      found: "(",
      fatal: false
    })
  })
})
