import { expect, test } from "bun:test"
import {
	alphabet,
	chain,
	char,
	digit,
	many1,
	optional,
	or,
	sepBy,
	sequence,
	skipSpaces,
} from "./combinators"

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
	const p = chain(stringParser, (s) =>
		integerParser.map((n) => s.repeat(n)),
	)
	console.log(p.parseOrThrow('"hello" 2'))
})
