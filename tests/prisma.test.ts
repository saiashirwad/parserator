import {
	Parser,
	alphabet,
	char,
	digit,
	many1,
	manyN,
	optional,
	or,
	skipSpaces,
} from "../src/index"
import { printPosition } from "../src/utils"

const word = or(alphabet, char("_"))
	.withError(
		"A word must start with a letter or underscore",
	)
	.zip(many1(or(alphabet, char("_"), digit)))
	.map(([first, rest]) => first + rest.join(""))

const expression = Parser.gen(function* () {
	const name = yield* word.trim(skipSpaces)
	const operator = yield* char("=")
		.withErrorCallback((error) => {
			return `Expected '=' at ${printPosition(error.pos)} but found ${error}`
		})
		.trim(skipSpaces)
	const sign = yield* optional(char("-")).map((x) =>
		x ? -1 : 1,
	)
	const value = yield* manyN(digit, 3)
		.trim(skipSpaces)
		.map((digits) => Number(digits.join("")))

	return { name, operator, value: sign * value }
})

const result = expression.parseOrError("aab >= 2234")
console.log(result)
