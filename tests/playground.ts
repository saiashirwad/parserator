import {
	Parser,
	ParserError,
	State,
	char,
	many0,
	many1,
	optional,
	or,
	parser,
} from "../src"

const requiredWhitespace = many1(or(char(" "), char("\n"))).withError(
	() => "Expected a whitespace here",
)

const something = parser(function* () {
	yield* char("h")
	yield* requiredWhitespace
	const something = yield* optional(char("."))
	if (something) {
		const message = "I did not expect a '.' there :("
		return yield* Parser.error(message, [""], (state) => State.move(state, -1))
	}
	yield* char("i")
	yield* requiredWhitespace

	return { hi: true }
})

const result = something.parseOrError("h\n\n.hasdf")
if (result instanceof ParserError) {
	console.error(result.message)
} else {
}
