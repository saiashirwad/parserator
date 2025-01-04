import {
	Parser,
	ParserError,
	alphabet,
	char,
	digit,
	many0,
	many1,
	manyN,
	optional,
	or,
	skipSpaces,
	string,
} from "../src/index"

const whitespace = many0(
	or(char(" "), char("\n"), char(".")),
)

const word = or(alphabet, char("_"))
	.withError(
		() => "A word must start with a letter or underscore",
	)
	.zip(many1(or(alphabet, char("_"), digit)))
	.map(([first, rest]) => first + rest.join(""))

const expression = Parser.gen(function* () {
	const name = yield* word.trim(whitespace)
	const operator = yield* string("==").trim(skipSpaces)
	const sign = yield* optional(char("-")).map((x) =>
		x ? -1 : 1,
	)
	const value = yield* manyN(digit, 3)
		.trim(skipSpaces)
		.map((digits) => Number(digits.join("")))

	return { name, operator, value: sign * value }
})

const result = expression.parseOrError(`
.
.
.
.
_hi -= 2234`)

if (result instanceof ParserError) {
	console.log(result)
	console.error(result.message)
}
