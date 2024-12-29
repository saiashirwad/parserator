import { describe, expect, test } from "bun:test"
import {
	alphabet,
	char,
	digit,
	many1,
	or,
	sepBy,
	skipSpaces,
} from "./combinators"

const stringParser = skipSpaces
	.then(char('"'))
	.then(many1(or(alphabet, digit)))
	.thenDiscard(char('"'))
	.map((s) => s.join(""))

const integerParser = skipSpaces
	.then(digit)
	.map((s) => parseInt(s))

describe("SepBy", () => {
	test("sepBy simple", () => {
		const p = sepBy(char(","), digit)
		expect(p.parseOrThrow("1,2,3")).toEqual(["1", "2", "3"])
	})

	test("sepBy empty", () => {
		const p = sepBy(char(","), digit)
		expect(p.parseOrThrow("")).toEqual([])
	})

	test("sepBy compound parser", () => {
		const p = sepBy(char(","), stringParser)
		expect(
			p.parseOrThrow('"hello", "world", "foo"'),
		).toEqual(["hello", "world", "foo"])
	})

	test("sepBy string array", () => {
		const p = char("[")
			.then(
				sepBy(char(","), or(stringParser, integerParser)),
			)
			.thenDiscard(char("]"))
		console.log(p.parseOrThrow('["hello", 2, "foo"]'))
		expect(p.parseOrThrow('["hello", 2, "foo"]')).toEqual([
			"hello",
			2,
			"foo",
		])
	})
})
