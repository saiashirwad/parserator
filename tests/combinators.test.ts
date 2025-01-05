import { describe, expect, test } from "bun:test"
import { chain } from "../src/chain"
import {
	alphabet,
	between,
	char,
	digit,
	lookAhead,
	many0,
	many1,
	manyN,
	manyNExact,
	optional,
	or,
	regex,
	sepBy,
	sequence,
	skipSpaces,
	takeUntil,
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
	.withError(() => "Expected an integer")

test("sepBy string array", () => {
	const p = char("[")
		.then(sepBy(char(","), or(stringParser, integerParser)))
		.thenDiscard(char("]"))
	expect(p.parseOrThrow('["hello", 2, "foo"]')).toEqual(["hello", 2, "foo"])
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
	const lengthPrefixedList = chain(integerParser, (length) =>
		skipSpaces
			.then(char("["))
			.then(manyN(stringParser, length, char(",")))
			.thenDiscard(char("]"))
			.map((items) => ({ items, length })),
	)
	const p = Parser.gen(function* () {
		const s = yield* lengthPrefixedList
		if (s.length !== s.items.length) {
			return yield* Parser.error("Length mismatch")
		}
		return s.items
	})

	expect(p.parseOrError('2 ["foo", "bar"]')).toEqual(["foo", "bar"])
	expect(Either.isLeft(p.parse('2 ["foo"]').result)).toEqual(true)
})

describe("regex", () => {
	test("should match at the start of the input", () => {
		const p = regex(/foo/)
		expect(p.parseOrThrow("foo")).toEqual("foo")
	})

	test("should not match at the start of the input", () => {
		const p = regex(/foo/)
		expect(Either.isLeft(p.parse("bar").result)).toEqual(true)
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
		expect(Either.isLeft(p.parse("b").result)).toBe(true)
		expect(Either.isLeft(p.parse("").result)).toBe(true)
	})

	test("digit", () => {
		expect(digit.parseOrThrow("1")).toBe("1")
		expect(digit.parseOrThrow("9")).toBe("9")
		expect(Either.isLeft(digit.parse("a").result)).toBe(true)
		expect(Either.isLeft(digit.parse("").result)).toBe(true)
	})

	test("alphabet", () => {
		expect(alphabet.parseOrThrow("a")).toBe("a")
		expect(alphabet.parseOrThrow("Z")).toBe("Z")
		expect(Either.isLeft(alphabet.parse("1").result)).toBe(true)
		expect(Either.isLeft(alphabet.parse("").result)).toBe(true)
	})
})

describe("many combinators", () => {
	test("many1 requires at least one match", () => {
		const digits = many1(digit)
		expect(digits.parseOrThrow("123")).toEqual(["1", "2", "3"])
		expect(digits.parseOrThrow("1")).toEqual(["1"])
		expect(Either.isLeft(digits.parse("").result)).toBe(true)
		expect(Either.isLeft(digits.parse("abc").result)).toBe(true)
	})

	test("manyNExact requires exactly n matches", () => {
		const threeDigits = manyNExact(digit, 3)
		const t1 = threeDigits.parseOrError("123")
		expect(t1).toEqual(["1", "2", "3"])
		expect(Either.isLeft(threeDigits.parse("12").result)).toBe(true)
		const t2 = threeDigits.parse("1234")
		expect(Either.isLeft(t2.result)).toBe(true)
		expect(Either.isLeft(threeDigits.parse("").result)).toBe(true)
	})

	test("manyN with separator", () => {
		const threeDigitsComma = manyN(digit, 3, char(",")).thenDiscard(
			lookAhead(or(char("\n"), Parser.pure(undefined))),
		)
		expect(threeDigitsComma.parseOrThrow("1,2,3")).toEqual(["1", "2", "3"])
		expect(Either.isLeft(threeDigitsComma.parse("1,2").result)).toBe(true)
	})
})

describe("complex combinations", () => {
	test("nested array of numbers", () => {
		type Value = number | Value[]
		const value = Parser.lazy(() => or(number, array))
		const number = many1(digit).map((s) => parseInt(s.join("")))
		const array: Parser<Value[]> = char("[")
			.then(sepBy(char(","), value))
			.thenDiscard(char("]"))

		expect(value.parseOrError("[1,2,[3,4],5]")).toEqual([1, 2, [3, 4], 5])
		expect(Either.isLeft(value.parse("[1,2,[3,4],]").result)).toBe(true)
	})

	test("simple expression parser", () => {
		type Expr = number
		const expr: Parser<Expr> = Parser.lazy(() => or(number, parens))
		const number = many1(digit).map((s) => parseInt(s.join("")))
		const parens: Parser<number> = char("(")
			.then(expr)
			.thenDiscard(char(")"))
			.map((n: number) => n * 2)
		expect(expr.parseOrThrow("123")).toBe(123)
		expect(expr.parseOrThrow("(123)")).toBe(246)
		expect(expr.parseOrThrow("((123))")).toBe(492)
		expect(Either.isLeft(expr.parse("(123").result)).toBe(true)
	})

	test("key-value parser", () => {
		const key = many1(alphabet).map((s) => s.join(""))
		const value = many1(digit).map((s) => parseInt(s.join("")))
		const pair = key
			.thenDiscard(char(":"))
			.flatMap((k) => value.map((v) => [k, v] as const))
		const object = char("{")
			.then(sepBy(char(","), pair))
			.thenDiscard(char("}"))
			.map(Object.fromEntries)
		expect(object.parseOrThrow("{foo:123,bar:456}")).toEqual({
			foo: 123,
			bar: 456,
		})
		expect(Either.isLeft(object.parse("{foo:123,}").result)).toBe(true)
	})
})

describe("error handling", () => {
	test("custom error messages", () => {
		const p = digit.withError(
			({ state }) => `Expected a digit at position ${state.pos.offset}`,
		)
		const { result } = p.parse("a")
		expect(Either.isLeft(result)).toBe(true)
	})

	test("error callback", () => {
		const p = digit.withError(
			({ state }) => `Expected a digit at position ${state.pos.offset}`,
		)
		const { result } = p.parse("a")
		expect(Either.isLeft(result)).toBe(true)
	})
})

describe("parser composition", () => {
	test("map transformation", () => {
		const p = digit.map(Number)
		expect(p.parseOrThrow("5")).toBe(5)
	})

	test("flatMap chaining", () => {
		const p = digit.flatMap((d) => digit.map((d2) => Number(d + d2)))
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
		expect(Either.isLeft(p.parse("b").result)).toBe(true)
	})

	test("sequence with type inference", () => {
		const p = sequence([digit.map(Number), char("+"), digit.map(Number)])
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
		const identifier = regex(/[a-z]+/).withError(
			() => "Expected lowercase identifier",
		)
		const number = regex(/[0-9]+/).withError(() => "Expected number")
		const assignment = identifier
			.thenDiscard(char("=").thenDiscard(skipSpaces))
			.then(number)
			.withError(({ error }) => error.message)

		const { result } = assignment.parse("foo = bar")
		expect(Either.isLeft(result)).toBe(true)
	})

	test("error position tracking", () => {
		const p = many1(digit).thenDiscard(char(";"))
		const { result, state } = p.parse("123x")
		expect(Either.isLeft(result)).toBe(true)
		if (Either.isLeft(result)) {
			console.log(state.pos)
			expect(state.pos.offset).toBe(3)
		}
	})
})

describe("between", () => {
	test("between parser", () => {
		const p = between(char("("), char(")"), many1(digit))
		expect(p.parseOrThrow("(123)")).toEqual(["1", "2", "3"])
	})

	test("between with nested parsers", () => {
		const strParser = char('"')
			.then(many1(or(alphabet, digit)))
			.thenDiscard(char('"'))
			.map((s) => s.join(""))
		const p = between(
			char("["),
			char("]"),
			sepBy(
				many0(char(" "))
					.then(char(","))
					.then(many0(char(" "))),
				strParser,
			),
		)
		const result = p.parseOrThrow('["hello", "world"]')
		expect(result).toEqual(["hello", "world"])
	})
})

describe("takeUntil", () => {
	test("takeUntil 1", () => {
		const p = takeUntil(char("a"))
		expect(p.parseOrThrow("123142abc")).toBe("123142")
	})

	test("takeUntil 2", () => {
		const strParser = char('"')
			.then(many1(or(alphabet, digit)))
			.thenDiscard(char('"'))
			.map((s) => s.join(""))
		const p = takeUntil(strParser)
		expect(p.parseOrThrow('this is a "hello"')).toBe("this is a ")
	})
})
