import {
	Parser,
	ParserError,
	State,
	char,
	many0,
	optional,
	or,
	parser,
} from "../src"

const whitespace = many0(or(char(" "), char("\n")))

const something = parser(function* () {
	yield* char("h")
	yield* whitespace
	const something = yield* optional(char("."))
	if (something) {
		return yield* Parser.error("I did not expect a '.' there :(", [], (state) =>
			State.move(state, -1),
		)
	}
	yield* char("i")
	yield* whitespace

	return { hi: true }
})

const result = something.parseOrError("h\n\n\n.hasdf")
if (result instanceof ParserError) {
	console.log(result)
	console.error(result.message)
} else {
	console.log(result)
}
