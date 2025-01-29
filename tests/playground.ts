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

const whitespace = or(char(" "), char("\n"))

const something = parser(function* () {
	yield* char("h")
	yield* whitespace.withError(() => "hi")
	yield* whitespace.withError(() => "hi")
	yield* whitespace.withError(() => "hi")
	const something = yield* optional(char("."))
	if (something) {
		const message = "I did not expect a '.' there :("
		return yield* Parser.error(message, [], (state) => State.move(state, -1))
	}
	yield* char("i")
	yield* whitespace

	return { hi: true }
})

const result = something.parseOrError("h\n\n\n.hasdf")
if (result instanceof ParserError) {
	console.error(result.message)
} else {
}
