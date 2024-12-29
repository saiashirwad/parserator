import { expect, test } from "bun:test"
import {
	alphabet,
	char,
	digit,
	many1,
	manyN,
	optional,
	or,
	sepBy,
	sequence,
	skipSpaces,
	string,
} from "./combinators"
import { chain } from "./chain"
import { Parser } from "./parser"

const stringParser = skipSpaces
	.then(char('"'))
	.then(many1(or(alphabet, digit)))
	.thenDiscard(char('"'))
	.map((s) => s.join(""))

const integerParser = skipSpaces
	.then(many1(digit))
	.map((s) => parseInt(s.join("")))
	.error("Expected an integer")

test("sepBy string array", () => {
	const p = char("[")
		.then(sepBy(char(","), or(stringParser, integerParser)))
		.thenDiscard(char("]"))
	expect(p.parseOrThrow('["hello", 2, "foo"]')).toEqual([
		"hello",
		2,
		"foo",
	])
})

test("optional", () => {
	const p = optional(or(stringParser, integerParser))
	expect(p.parseOrThrow('"hello"')).toEqual("hello")
	expect(p.parseOrThrow("123")).toEqual(123)
})

test("sequence", () => {
	const p = sequence([
		stringParser,
		skipSpaces,
		char(","),
		skipSpaces,
		integerParser,
		skipSpaces,
		char(","),
		skipSpaces,
		integerParser,
	])
	expect(p.parseOrThrow('"hello", 123, 23')).toEqual(23)
})

test("chain", () => {
	// Chain can be used to build parsers where each step depends on previous values
	// Here's an example of parsing a list with a specified length
	const lengthPrefixedList = chain(
		integerParser,
		(length) =>
			skipSpaces
				.then(char("["))
				.then(manyN(stringParser, length, char(",")))
				.thenDiscard(char("]"))
				.map((items) => ({ items, length })),
	)
	const p = Parser.gen(function* () {
		const s = yield* lengthPrefixedList
		if (s.length !== s.items.length) {
			return yield* Parser.fail("Length mismatch")
		}
		// if (s.length !== s.items.length) {
		// 	return yield* Parser.fail("Length mismatch")
		// }
		return s.items
	})
	console.log(
		lengthPrefixedList.parseOrError(
			'2 ["foo", "bar", "baz"]',
		),
	)

	type a = never | number

	// expect(
	// 	lengthPrefixedList.parseOrThrow('2 ["foo", "bar"]'),
	// ).toEqual(["foo", "bar"])
	// expect(() =>
	// 	lengthPrefixedList.parseOrThrow('2 ["foo"]'),
	// ).toThrow() // Too few items
	// expect(() =>
	// 	lengthPrefixedList.parseOrThrow(
	// 		'2 ["foo", "bar", "baz"]',
	// 	),
	// ).toThrow() // Too many items
})
