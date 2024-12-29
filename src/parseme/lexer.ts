import { char, or, digit, many1, manyN, optional } from "./combinators"
import { Parser } from "./parser"

export function skipWhitespace(): Parser<undefined> {
	return Parser.gen(function* () {
		while (true) {
			const result = yield* optional(char(" "))
			if (!result) {
				return undefined
			}
		}
	})
}

export const integer2: Parser<number> = Parser.gen(function* () {
	const sign = yield* optional(char("-"))
	const digits = yield* manyN(digit, 2).error("WUT, i need 2 digits, minimum")
	const numStr = (sign ?? "") + digits.join("")
	return parseInt(numStr, 10)
})

export const float: Parser<number> = Parser.gen(function* () {
	const sign = yield* optional(char("-"))
	const intPart = yield* many1(digit)
	const fractionalPart = yield* optional(
		Parser.gen(function* () {
			yield* char(".")
			return yield* many1(digit)
		}),
	)
	const exponentPart = yield* optional(
		Parser.gen(function* () {
			yield* char("e")
			const expSign = yield* optional(or(char("+"), char("-")))
			const expDigits = yield* many1(digit)
			return (expSign ?? "") + expDigits.join("")
		}),
	)

	const numStr =
		(sign ?? "") +
		intPart.join("") +
		(fractionalPart ? "." + fractionalPart.join("") : "") +
		(exponentPart ? "e" + exponentPart : "")

	return parseFloat(numStr)
})
