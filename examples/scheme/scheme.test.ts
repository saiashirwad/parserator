import { describe, expect, it } from "bun:test"
import { LispExpr } from "./ast"
import { expr } from "./parser"

describe("scheme", () => {
	it("should parse a simple expression", () => {
		const result = expr.parseOrThrow("(+ 1 2)")
		expect(result).toEqual(
			LispExpr.list([
				LispExpr.symbol("+"),
				LispExpr.number(1),
				LispExpr.number(2),
			]),
		)
	})

	it("should parse a nested expression", () => {
		const result = expr.parseOrThrow("(+ 1 (+ 2 3))")
		expect(result).toEqual(
			LispExpr.list([
				LispExpr.symbol("+"),
				LispExpr.number(1),
				LispExpr.list([
					LispExpr.symbol("+"),
					LispExpr.number(2),
					LispExpr.number(3),
				]),
			]),
		)
	})

	it("should parse a string literal", () => {
		const result = expr.parseOrThrow('"hello"')
		expect(result).toEqual(LispExpr.string("hello"))
	})

	it("should parse a boolean literal", () => {
		const result1 = expr.parseOrThrow("#t")
		expect(result1).toEqual(LispExpr.bool(true))
		const result2 = expr.parseOrThrow("#f")
		expect(result2).toEqual(LispExpr.bool(false))
	})

	it("should parse a symbol", () => {
		const result = expr.parseOrThrow("hello")
		expect(result).toEqual(LispExpr.symbol("hello"))
	})

	it("should parse a symbol with special characters", () => {
		const result = expr.parseOrThrow("hello-world!")
		expect(result).toEqual(LispExpr.symbol("hello-world!"))
	})

	it("should fail on empty symbol", () => {
		const { result } = expr.parse("")
		expect(result._tag).toEqual("Left")
	})

	it("should parse a list", () => {
		const result = expr.parseOrThrow("(1 2 3)")
		expect(result).toEqual(
			LispExpr.list([
				LispExpr.number(1),
				LispExpr.number(2),
				LispExpr.number(3),
			]),
		)
	})

	it("should fail on empty list", () => {
		const { result } = expr.parse("()")
		expect(result._tag).toEqual("Left")
	})

	it("should parse a let expression with multiple bindings", () => {
		const result = expr.parseOrThrow("(let ((x 1) (y 2)) (+ x y))")
		expect(result).toEqual(
			LispExpr.let(
				[
					{ name: "x", value: LispExpr.number(1) },
					{ name: "y", value: LispExpr.number(2) },
				],
				LispExpr.list([
					LispExpr.symbol("+"),
					LispExpr.symbol("x"),
					LispExpr.symbol("y"),
				]),
			),
		)
	})

	it("should parse a let expression with a nested let expression", () => {
		const result = expr.parseOrThrow("(let ((x 1)) (let ((y 2)) (+ x y)))")
		expect(result).toEqual(
			LispExpr.let(
				[{ name: "x", value: LispExpr.number(1) }],
				LispExpr.let(
					[{ name: "y", value: LispExpr.number(2) }],
					LispExpr.list([
						LispExpr.symbol("+"),
						LispExpr.symbol("x"),
						LispExpr.symbol("y"),
					]),
				),
			),
		)
	})

	it("should parse a lambda expression", () => {
		const result = expr.parseOrThrow("(lambda (x) (+ x 2))")
		expect(result).toEqual(
			LispExpr.lambda(
				["x"],
				LispExpr.list([
					LispExpr.symbol("+"),
					LispExpr.symbol("x"),
					LispExpr.number(2),
				]),
			),
		)
	})

	it("should parse a let expression with a lambda expression", () => {
		const result = expr.parseOrThrow("(let ((x (lambda (y) y))) (x))")
		expect(result).toEqual(
			LispExpr.let(
				[
					{
						name: "x",
						value: LispExpr.lambda(["y"], LispExpr.symbol("y")),
					},
				],
				LispExpr.list([LispExpr.symbol("x")]),
			),
		)
	})

	it("should parse a list", () => {
		const result = expr.parseOrThrow("(a b c)")
		expect(result).toEqual(
			LispExpr.list([
				LispExpr.symbol("a"),
				LispExpr.symbol("b"),
				LispExpr.symbol("c"),
			]),
		)
	})

	it("should parse a let expression with a single binding", () => {
		const result = expr.parseOrThrow("(let ((x 1)) x)")
		expect(result).toEqual(
			LispExpr.let(
				[{ name: "x", value: LispExpr.number(1) }],
				LispExpr.symbol("x"),
			),
		)
	})
})
