import { describe, expect, test } from "bun:test"
import { chain } from "../src/chain"
import {
	alphabet,
	char,
	digit,
	many1,
	manyN,
	optional,
	or,
	regex,
	sepBy,
	sequence,
	skipSpaces,
} from "../src/combinators"
import { Either } from "../src/either"
import { Parser } from "../src/parser"

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
		return s.items
	})

	expect(p.parseOrError('2 ["foo", "bar"]')).toEqual([
		"foo",
		"bar",
	])
	expect(Either.isLeft(p.run('2 ["foo"]'))).toEqual(true)
})

describe("regex", () => {
	test("should match at the start of the input", () => {
		const p = regex(/foo/)
		expect(p.parseOrThrow("foo")).toEqual("foo")
	})

	test("should not match at the start of the input", () => {
		const p = regex(/foo/)
		expect(Either.isLeft(p.run("bar"))).toEqual(true)
	})

	test("should match at the start of the input with global flag", () => {
		const p = regex(/foo/g)
		expect(p.parseOrThrow("foo")).toEqual("foo")
	})
})
