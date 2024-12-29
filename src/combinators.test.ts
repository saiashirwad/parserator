import { describe, expect, test } from "bun:test"
import {
	alphabet,
	between,
	char,
	digit,
	many1,
	optional,
	or,
	sepBy,
} from "./combinators"
import { Either } from "./either"

// describe("Basic Parsers", () => {
// 	test("char parser", () => {
// 		const p = char("a")
// 		expect(Either.isRight(p.run("abc"))).toBe(true)
// 		expect(Either.isRight(p.run("b"))).toBe(false)
// 		expect(p.parseOrError("abc")).toBe("a")
// 	})

// 	test("parse integer", () => {
// 		const p = many1(digit).map((digits) =>
// 			parseInt(digits.join(""), 10),
// 		)
// 		expect(Either.isRight(p.run("123"))).toBe(true)
// 		expect(Either.isRight(p.run("abc"))).toBe(false)
// 		expect(p.parseOrError("123")).toBe(123)
// 	})

// 	test("string parser", () => {
// 		const p = string("hello")
// 		expect(Either.isRight(p.run("hello world"))).toBe(true)
// 		expect(Either.isRight(p.run("goodbye"))).toBe(false)
// 		expect(p.parseOrError("hello world")).toBe("hello")
// 	})

// 	test("alphabet parser", () => {
// 		expect(Either.isRight(alphabet.run("abc"))).toBe(true)
// 		expect(Either.isRight(alphabet.run("123"))).toBe(false)
// 		expect(alphabet.parseOrError("abc")).toBe("a")
// 	})

// 	test("digit parser", () => {
// 		expect(Either.isRight(digit.run("123"))).toBe(true)
// 		expect(Either.isRight(digit.run("abc"))).toBe(false)
// 		expect(digit.parseOrError("123")).toBe("1")
// 	})
// })

// describe("Repetition Parsers", () => {
// 	test("many0", () => {
// 		const p = many0(char("a"))
// 		expect(p.parseOrError("")).toEqual([])
// 		expect(p.parseOrError("a")).toEqual(["a"])
// 		expect(p.parseOrError("aaa")).toEqual(["a", "a", "a"])
// 		expect(p.parseOrError("aaab")).toEqual(["a", "a", "a"])
// 	})

// 	test("many1", () => {
// 		const p = many1(char("a"))
// 		expect(Either.isRight(p.run(""))).toBe(false)
// 		expect(p.parseOrError("a")).toEqual(["a"])
// 		expect(p.parseOrError("aaa")).toEqual(["a", "a", "a"])
// 		expect(p.parseOrError("aaab")).toEqual(["a", "a", "a"])
// 	})

// 	// test("manyN", () => {
// 	// 	const p = manyN(char("a"), 2)
// 	// 	expect(Either.isRight(p.run("a"))).toBe(false)
// 	// 	expect(p.parseOrError("aa")).toEqual(["a", "a"])
// 	// 	expect(p.parseOrError("aaa")).toEqual(["a", "a"])
// 	// })
// })

describe("Combinators", () => {
	test("or 1", () => {
		const p = or(char("a"), char("b"))
		expect(p.parseOrError("a")).toBe("a")
		expect(p.parseOrError("b")).toBe("b")
		expect(Either.isRight(p.run("c"))).toBe(false)
	})

	test("or 2", () => {
		const p = or(char("a"), char("b"))
		expect(p.parseOrError("a")).toBe("a")
		expect(p.parseOrError("b")).toBe("b")
		expect(Either.isRight(p.run("c"))).toBe(false)
	})

	test("or with multiple parsers", () => {
		const p = or(char("a"), char("b"), char("c"), char("d"))
		expect(p.parseOrError("a")).toBe("a")
		expect(p.parseOrError("b")).toBe("b")
		expect(p.parseOrError("c")).toBe("c")
		expect(p.parseOrError("d")).toBe("d")
		expect(Either.isRight(p.run("e"))).toBe(false)
	})

	test("or with named parsers shows expected names in error", () => {
		const a = char("a").withName("letterA")
		const b = char("b").withName("letterB")
		const p = or(a, b)
		const result = p.run("c")
		expect(Either.isLeft(result)).toBe(true)
		if (Either.isLeft(result)) {
			expect(result.left.expected).toEqual([
				"letterA",
				"letterB",
			])
		}
	})

	test("or with complex parsers", () => {
		const digits = many1(digit).map((d) => d.join(""))
		const letters = many1(alphabet).map((l) => l.join(""))
		const p = or(digits, letters)

		expect(p.parseOrError("123")).toBe("123")
		expect(p.parseOrError("abc")).toBe("abc")
		expect(Either.isRight(p.run("!@#"))).toBe(false)
	})

	test("optional", () => {
		const p = optional(char("a"))
		expect(p.parseOrError("a")).toBe("a")
		expect(p.parseOrError("b")).toBeUndefined()
	})

	test("between", () => {
		const p = between(char("("), char(")"), digit)
		const result = p.run("(5)")
		expect(Either.isRight(result)).toBe(true)
		if (Either.isRight(result)) {
			expect(result.right[0]).toBe("5")
		}
		expect(Either.isRight(p.run("()"))).toBe(false)
		expect(Either.isRight(p.run("5"))).toBe(false)
	})

	test("sepBy", () => {
		const p = sepBy(char(","), digit)
		expect(p.parseOrError("")).toEqual([])
		expect(p.parseOrError("1")).toEqual(["1"])
		expect(p.parseOrError("1,2,3")).toEqual(["1", "2", "3"])
	})
})

// describe("Lookahead Parsers", () => {
// 	test("lookAhead", () => {
// 		const p = lookAhead(char("a"))
// 		const result = p.run("abc")
// 		expect(Either.isRight(result)).toBe(true)
// 		if (Either.isRight(result)) {
// 			// Should return 'a' but not consume it
// 			expect(result.right[0]).toBe("a")
// 			expect(result.right[1].remaining).toBe("abc")
// 		}
// 	})

// 	test("notFollowedBy", () => {
// 		const p = notFollowedBy(char("a"))
// 		expect(Either.isRight(p.run("bcd"))).toBe(true)
// 		expect(Either.isRight(p.run("abc"))).toBe(false)
// 	})
// })

// describe("Whitespace", () => {
// 	test("skipSpaces", () => {
// 		const result = skipSpaces.run("   abc")
// 		expect(Either.isRight(result)).toBe(true)
// 		if (Either.isRight(result)) {
// 			expect(result.right[1].remaining).toBe("abc")
// 		}
// 	})
// })

// describe("Complex Combinations", () => {
// 	test("parsing simple arithmetic", () => {
// 		const p = arithSExpression
// 		const result = p.run("(+ 1 2)")
// 		expect(Either.isRight(result)).toBe(true)
// 		if (Either.isRight(result)) {
// 			expect(result.right[0]).toEqual({
// 				op: "+",
// 				left: 1,
// 				right: 2,
// 			})
// 		}
// 	})

// 	test("parsing repeated patterns", () => {
// 		// Parse things like: a1,a2,a3
// 		const p = sepBy(char(","), char("a").then(digit))
// 		expect(p.parseOrError("a1,a2,a3")).toEqual([
// 			"1",
// 			"2",
// 			"3",
// 		])
// 	})

// 	test("optional with lookahead", () => {
// 		// Parse 'a' if not followed by 'b'
// 		const p = char("a").thenDiscard(
// 			notFollowedBy(char("b")),
// 		)
// 		expect(Either.isRight(p.run("ac"))).toBe(true)
// 		expect(Either.isRight(p.run("ab"))).toBe(false)
// 	})
// })
