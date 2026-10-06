import { describe, expect, it } from "vitest"
import { Expr, Pattern, Type } from "../examples/toyml/ast.ts"
import {
  declaration,
  expr,
  nonSequenceExpr,
  pattern,
  programParser,
  typeExpr
} from "../examples/toyml/parser.ts"

const a = Expr.var("a")
const b = Expr.var("b")
const c = Expr.var("c")

describe("ToyML parser contracts", () => {
  it.each(["::", "@", "^", "&&", "||"])(
    "keeps %s right-associative across repeated parses",
    op => {
      const expected = Expr.infix(a, op, Expr.infix(b, op, c))
      expect(expr.parseOrThrow(`a ${op} b ${op} c`)).toEqual(expected)
      expect(expr.parseOrThrow(`a ${op} b ${op} c`)).toEqual(expected)
    }
  )

  it("keeps precedence and left-associative subtraction", () => {
    expect(expr.parseOrThrow("a - b - c * a")).toEqual(
      Expr.infix(Expr.infix(a, "-", b), "-", Expr.infix(c, "*", a))
    )
    expect(expr.parseOrThrow("a <= b")).toEqual(Expr.infix(a, "<=", b))
  })

  it.each(["+", "::", "@", "&&", "||"])(
    "retains the operator-specific diagnostic after %s",
    op => {
      const input = `a ${op} b ${op}`
      const result = expr.parse(input)
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.toJSON()).toEqual({
        kind: "expected",
        span: { start: input.length, end: input.length },
        expected: [`expression after '${op}'`],
        fatal: false
      })
    }
  )

  it("keeps pattern cons left-associative and type arrows right-associative", () => {
    expect(pattern.parseOrThrow("a :: b :: c")).toEqual(
      Pattern.cons(
        Pattern.cons(Pattern.var("a"), Pattern.var("b")),
        Pattern.var("c")
      )
    )
    expect(typeExpr.parseOrThrow("a -> b -> c")).toEqual(
      Type.arrow(Type.const("a"), Type.arrow(Type.const("b"), Type.const("c")))
    )
  })

  it("retains optional annotation and record-access rollback", () => {
    expect(expr.parsePrefix("a :")).toEqual({
      success: true,
      value: a,
      offset: 1,
      rest: " :"
    })
    expect(pattern.parsePrefix("a :")).toEqual({
      success: true,
      value: Pattern.var("a"),
      offset: 1,
      rest: " :"
    })
    expect(expr.parsePrefix("a.")).toEqual({
      success: true,
      value: a,
      offset: 1,
      rest: "."
    })
    expect(expr.parseOrThrow("a : int")).toEqual(Expr.annotated(a, Type.int()))
    expect(pattern.parseOrThrow("a : int")).toEqual(
      Pattern.annotated(Pattern.var("a"), Type.int())
    )
  })

  it("keeps application and field access interleaved", () => {
    expect(expr.parseOrThrow("a.field b.next")).toEqual(
      Expr.recordAccess(Expr.app(Expr.recordAccess(a, "field"), b), "next")
    )
  })

  it("preserves leading trivia and character-delimiter diagnostics", () => {
    expect(expr.parseOrThrow("(* c *) [a; b;]")).toEqual(Expr.list([a, b]))
    const result = expr.parse("[a")
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.toJSON()).toEqual({
      kind: "expected",
      span: { start: 2, end: 2 },
      expected: ["closing bracket for list"],
      fatal: false
    })
    expect(expr.parse("a [").success).toBe(false)
  })

  it("keeps record attempts recoverable and empty match bodies fatal", () => {
    expect(expr.parsePrefix("a {x =")).toEqual({
      success: true,
      value: a,
      offset: 1,
      rest: " {x ="
    })
    const result = expr.parse("match x with | A -> | B -> z")
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.toJSON()).toEqual({
      kind: "custom",
      span: { start: 21, end: 21 },
      message: "empty match case body (found '|' instead of expression)",
      fatal: true
    })
  })

  it("keeps sequence boundaries and declaration exports", () => {
    expect(expr.parseOrThrow("a; b; c")).toEqual(
      Expr.sequence(Expr.sequence(a, b), c)
    )
    expect(nonSequenceExpr.parsePrefix("a; b")).toEqual({
      success: true,
      value: a,
      offset: 1,
      rest: "; b"
    })
    const input = "let x = 1"
    expect(programParser.parseOrThrow(`${input};;`)).toEqual([
      declaration.parseOrThrow(input)
    ])
    expect(expr.parseOrThrow("let x = 1 in x")).toEqual(
      Expr.let(
        {
          pattern: Pattern.var("x"),
          params: [],
          annotation: undefined,
          value: Expr.int(1)
        },
        Expr.var("x")
      )
    )
  })
})
