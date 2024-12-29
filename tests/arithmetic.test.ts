import { describe, expect, test } from "bun:test"
import {
	char,
	lookAhead,
	skipSpaces,
	Parser,
	or,
	many1,
	between,
	optional,
	regex,
} from "../src"

type Op =
	| "add"
	| "sub"
	| "mul"
	| "div"
	| "mod"
	| "lt"
	| "lte"
	| "gt"
	| "gte"
	| "eq"

type Expr =
	| { type: "number"; value: number }
	| { type: "op"; op: Op; left: Expr; right: Expr }

// const whitespace = skipSpaces
// const eof = lookAhead(char(""))

// // Main entry point for parsing expressions
// const parseExpr = (input: string): Expr => {
// 	const result = compareExpr
// 		.thenDiscard(eof)
// 		.parseOrThrow(input)
// 	return result
// }

// // Parse comparison operators
// const compareExpr: Parser<Expr> = Parser.lazy(() =>
// 	or(compare, expression),
// )

// const compare: Parser<Expr> = Parser.lazy(() =>
// 	expression.flatMap((left) =>
// 		or(
// 			char("<")
// 				.thenDiscard(whitespace)
// 				.map(() => "lt" as Op),
// 			char(">")
// 				.thenDiscard(whitespace)
// 				.map(() => "gt" as Op),
// 			string("<=")
// 				.thenDiscard(whitespace)
// 				.map(() => "lte" as Op),
// 			string(">=")
// 				.thenDiscard(whitespace)
// 				.map(() => "gte" as Op),
// 			string("==")
// 				.thenDiscard(whitespace)
// 				.map(() => "eq" as Op),
// 		).flatMap((op) =>
// 			expression.map((right) => ({
// 				type: "op",
// 				op,
// 				left,
// 				right,
// 			})),
// 		),
// 	),
// )

// const expression: Parser<Expr> = Parser.lazy(() =>
// 	or(addExpr, mulExpr, number, parenExpr),
// )

// const addExpr: Parser<Expr> = Parser.lazy(() =>
// 	mulExpr.flatMap((left) =>
// 		or(
// 			char("+")
// 				.thenDiscard(whitespace)
// 				.map(() => "add" as Op),
// 			char("-")
// 				.thenDiscard(whitespace)
// 				.map(() => "sub" as Op),
// 		).flatMap((op) =>
// 			expression.map((right) => ({
// 				type: "op",
// 				op,
// 				left,
// 				right,
// 			})),
// 		),
// 	),
// )

// // Parse multiplication and division
// const mulExpr: Parser<Expr> = Parser.lazy(() =>
// 	number.flatMap((left) =>
// 		or(
// 			char("*")
// 				.thenDiscard(whitespace)
// 				.map(() => "mul" as Op),
// 			char("/")
// 				.thenDiscard(whitespace)
// 				.map(() => "div" as Op),
// 			char("%")
// 				.thenDiscard(whitespace)
// 				.map(() => "mod" as Op),
// 		).flatMap((op) =>
// 			expression.map((right) => ({
// 				type: "op",
// 				op,
// 				left,
// 				right,
// 			})),
// 		),
// 	),
// )

// const number: Parser<Expr> = Parser.lazy(() => {
// 	const sign = optional(char("-"))
// 	const digits = many1(regex(/[0-9]/))

// 	return sign.flatMap((s) =>
// 		digits.thenDiscard(whitespace).map((ds) => ({
// 			type: "number" as const,
// 			value: Number((s || "") + ds.join("")),
// 		})),
// 	)
// })

// // Parse parenthesized expressions
// const parenExpr: Parser<Expr> = Parser.lazy(() =>
// 	between(
// 		char("(").thenDiscard(whitespace),
// 		char(")").thenDiscard(whitespace),
// 		expression,
// 	),
// )

// // Helper for string literals
// const string = (str: string): Parser<string> =>
// 	Parser.lazy(() => {
// 		const chars = str.split("").map((c) => char(c))
// 		return chars.reduce((acc, curr) => acc.then(curr))
// 	})

// describe("Arithmetic Parser", () => {
// 	test("parses simple numbers", () => {
// 		expect(parseExpr("42")).toEqual({
// 			type: "number",
// 			value: 42,
// 		})
// 		expect(parseExpr("-123")).toEqual({
// 			type: "number",
// 			value: -123,
// 		})
// 	})

// 	test("parses addition", () => {
// 		expect(parseExpr("1 + 2")).toEqual({
// 			type: "op",
// 			op: "add",
// 			left: { type: "number", value: 1 },
// 			right: { type: "number", value: 2 },
// 		})
// 	})

// 	test("parses multiplication", () => {
// 		expect(parseExpr("2 * 3")).toEqual({
// 			type: "op",
// 			op: "mul",
// 			left: { type: "number", value: 2 },
// 			right: { type: "number", value: 3 },
// 		})
// 	})

// 	test("parses comparison", () => {
// 		expect(parseExpr("1 < 2")).toEqual({
// 			type: "op",
// 			op: "lt",
// 			left: { type: "number", value: 1 },
// 			right: { type: "number", value: 2 },
// 		})
// 	})
// })
