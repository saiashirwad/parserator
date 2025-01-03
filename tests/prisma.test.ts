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
} from "../src/index"
import {
	printErrorContext,
	printPosition,
} from "../src/utils"

const whitespace = many0(
	or(char(" "), char("\n"), char(".")),
)

const word = or(alphabet, char("_"))
	.withError(
		"A word must start with a letter or underscore",
	)
	.zip(many1(or(alphabet, char("_"), digit)))
	.map(([first, rest]) => first + rest.join(""))

const expression = Parser.gen(function* () {
	const name = yield* word.trim(whitespace)
	const operator = yield* char("=")
		.withErrorCallback(({ error, state }) => {
			return printErrorContext(
				error,
				state,
				`Expected '=' at ${printPosition(error.pos)} but found '${state.source.slice(
					error.pos.offset,
					error.pos.offset + 1,
				)}'`,
			)
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

const result = expression.parseOrError(
	"\n.\n.\n.\n.\nhi -= 2234",
)

if (result instanceof ParserError) {
	console.error(result.message)
}
