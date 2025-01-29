import { ParserError, char, many0, or, parser } from "../src"

const whitespace = many0(or(char(" "), char("\n")))

const something = parser(function* () {
	yield* char("h").name("h")
	yield* whitespace.name("first whitespace")
	yield* char("i").name("i")
	yield* whitespace.name("last whitespace")

	return { hi: true }
})

const result = something.parseOrError("h\n\n\nhasdf")
if (result instanceof ParserError) {
	console.error(result.message)
} else {
	console.log(result)
}
