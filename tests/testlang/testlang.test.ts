import { describe, expect, test } from "bun:test"
import {
	code1,
	code2,
	code3,
	code4,
	expr1,
	expr2,
	expr3,
	expr4,
} from "./examples"
import { testlangParser } from "./testlang"

describe("testlang", () => {
	test("example 1", () => {
		const result = testlangParser.parse(code1)
		// @ts-ignore
		expect(result).toEqual(expr1)
	})

	test("example 2", () => {
		const result = testlangParser.parse(code2)
		// @ts-ignore
		expect(result).toEqual(expr2)
	})

	test("example 3", () => {
		const result = testlangParser.parse(code3)
		// @ts-ignore
		expect(result).toEqual(expr3)
	})

	test("example 4", () => {
		const result = testlangParser.parse(code4)
		// @ts-ignore
		expect(result).toEqual(expr4)
	})
})
