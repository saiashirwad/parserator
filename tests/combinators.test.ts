import { describe, expect, test } from "bun:test"
import { chain } from "../src/chain"
import {
	alphabet,
	char,
	digit,
	lookAhead,
	many1,
	manyN,
	manyNExact,
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

describe("basic combinators", () => {
	test("char", () => {
		const p = char("a")
		expect(p.parseOrThrow("a")).toBe("a")
		expect(Either.isLeft(p.run("b"))).toBe(true)
		expect(Either.isLeft(p.run(""))).toBe(true)
	})

	test("digit", () => {
		expect(digit.parseOrThrow("1")).toBe("1")
		expect(digit.parseOrThrow("9")).toBe("9")
		expect(Either.isLeft(digit.run("a"))).toBe(true)
		expect(Either.isLeft(digit.run(""))).toBe(true)
	})

	test("alphabet", () => {
		expect(alphabet.parseOrThrow("a")).toBe("a")
		expect(alphabet.parseOrThrow("Z")).toBe("Z")
		expect(Either.isLeft(alphabet.run("1"))).toBe(true)
		expect(Either.isLeft(alphabet.run(""))).toBe(true)
	})
})

describe("many combinators", () => {
	test("many1 requires at least one match", () => {
		const digits = many1(digit)
		expect(digits.parseOrThrow("123")).toEqual([
			"1",
			"2",
			"3",
		])
		expect(digits.parseOrThrow("1")).toEqual(["1"])
		expect(Either.isLeft(digits.run(""))).toBe(true)
		expect(Either.isLeft(digits.run("abc"))).toBe(true)
	})

	test("manyNExact requires exactly n matches", () => {
		const threeDigits = manyNExact(digit, 3)
		const t1 = threeDigits.parseOrThrow("123")
		expect(t1).toEqual(["1", "2", "3"])
		expect(Either.isLeft(threeDigits.run("12"))).toBe(true)
		const t2 = threeDigits.parseOrError("1234")
		console.log(t2)
		// expect(Either.isLeft(t2)).toBe(true)
		// expect(Either.isLeft(threeDigits.run(""))).toBe(true)
	})

	test("manyN with separator", () => {
		const threeDigitsComma = manyN(
			digit,
			3,
			char(","),
		).thenDiscard(
			lookAhead(or(char("\n"), Parser.pure(undefined))),
		)
		expect(threeDigitsComma.parseOrThrow("1,2,3")).toEqual([
			"1",
			"2",
			"3",
		])
		expect(Either.isLeft(threeDigitsComma.run("1,2"))).toBe(
			true,
		)
	})
})

describe("complex combinations", () => {
	test("nested array of numbers", () => {
		type Value = number | Value[]
		const value = Parser.lazy(() => or(number, array))
		const number = many1(digit).map((s) =>
			parseInt(s.join("")),
		)
		const array: Parser<Value[]> = char("[")
			.then(sepBy(char(","), value))
			.thenDiscard(char("]"))

		expect(value.parseOrError("[1,2,[3,4],5]")).toEqual([
			1,
			2,
			[3, 4],
			5,
		])
		expect(Either.isLeft(value.run("[1,2,[3,4],]"))).toBe(
			true,
		)
	})

	test("simple expression parser", () => {
		type Expr = number
		const expr: Parser<Expr> = Parser.lazy(() =>
			or(number, parens),
		)
		const number = many1(digit).map((s) =>
			parseInt(s.join("")),
		)
		const parens: Parser<number> = char("(")
			.then(expr)
			.thenDiscard(char(")"))
			.map((n: number) => n * 2)
		expect(expr.parseOrThrow("123")).toBe(123)
		expect(expr.parseOrThrow("(123)")).toBe(246)
		expect(expr.parseOrThrow("((123))")).toBe(492)
		expect(Either.isLeft(expr.run("(123"))).toBe(true)
	})

	test("key-value parser", () => {
		const key = many1(alphabet).map((s) => s.join(""))
		const value = many1(digit).map((s) =>
			parseInt(s.join("")),
		)
		const pair = key
			.thenDiscard(char(":"))
			.flatMap((k) => value.map((v) => [k, v] as const))
		const object = char("{")
			.then(sepBy(char(","), pair))
			.thenDiscard(char("}"))
			.map(Object.fromEntries)
		expect(
			object.parseOrThrow("{foo:123,bar:456}"),
		).toEqual({
			foo: 123,
			bar: 456,
		})
		expect(Either.isLeft(object.run("{foo:123,}"))).toBe(
			true,
		)
	})
})

describe("error handling", () => {
	test("custom error messages", () => {
		const p = digit.error("Expected a digit")
		const result = p.run("a")
		expect(Either.isLeft(result)).toBe(true)
		if (Either.isLeft(result)) {
			expect(result.left.message).toBe("Expected a digit")
		}
	})

	test("error callback", () => {
		const p = digit.errorCallback(
			(error, state) =>
				`Expected a digit at position ${state.pos.offset}`,
		)
		const result = p.run("a")
		expect(Either.isLeft(result)).toBe(true)
		if (Either.isLeft(result)) {
			expect(result.left.message).toBe(
				"Expected a digit at position 0",
			)
		}
	})
})

describe("parser composition", () => {
	test("map transformation", () => {
		const p = digit.map(Number)
		expect(p.parseOrThrow("5")).toBe(5)
	})

	test("flatMap chaining", () => {
		const p = digit.flatMap((d) =>
			digit.map((d2) => Number(d + d2)),
		)
		expect(p.parseOrThrow("12")).toBe(12)
	})

	test("then sequencing", () => {
		const p = char("[").then(digit).thenDiscard(char("]"))
		expect(p.parseOrThrow("[5]")).toBe("5")
	})
})

describe("advanced combinators", () => {
	test("lookAhead without consuming", () => {
		const p = lookAhead(char("a")).then(char("a"))
		expect(p.parseOrThrow("a")).toBe("a")
		expect(Either.isLeft(p.run("b"))).toBe(true)
	})

	test("sequence with type inference", () => {
		const p = sequence([
			digit.map(Number),
			char("+"),
			digit.map(Number),
		])
		expect(p.parseOrThrow("1+2")).toBe(2) // returns last value
	})

	test("sepBy with empty input", () => {
		const p = sepBy(char(","), digit)
		expect(p.parseOrThrow("")).toEqual([])
		expect(p.parseOrThrow("1")).toEqual(["1"])
		expect(p.parseOrThrow("1,2,3")).toEqual(["1", "2", "3"])
	})

	test("optional with chaining", () => {
		const p = optional(char("-")).flatMap((sign) =>
			many1(digit).map((digits) => ({
				sign: sign === "-" ? -1 : 1,
				value: Number(digits.join("")),
			})),
		)

		expect(p.parseOrThrow("123")).toEqual({
			sign: 1,
			value: 123,
		})
		expect(p.parseOrThrow("-123")).toEqual({
			sign: -1,
			value: 123,
		})
	})
})

describe("error recovery", () => {
	test("custom error with context", () => {
		const identifier = regex(/[a-z]+/).error(
			"Expected lowercase identifier",
		)
		const number = regex(/[0-9]+/).error("Expected number")
		const assignment = identifier
			.thenDiscard(char("=").thenDiscard(skipSpaces))
			.then(number)
			.errorCallback((error, _) => error.message)

		const result = assignment.run("foo = bar")
		expect(Either.isLeft(result)).toBe(true)
		// if (Either.isLeft(result)) {
		// 	console.log(result.left.message)
		// 	// expect(result.left.message).toBe("Expected number")
		// }
	})

	test("error position tracking", () => {
		const p = many1(digit).thenDiscard(char(";"))
		const result = p.run("123x")
		expect(Either.isLeft(result)).toBe(true)
		if (Either.isLeft(result)) {
			expect(result.left.pos.offset).toBe(3)
		}
	})
})
