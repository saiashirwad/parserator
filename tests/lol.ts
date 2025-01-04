import { ParserError, char, string } from "../src"

const lol = string("abc")
const result = lol.parseOrError(".abc")

if (result instanceof ParserError) {
	console.log(result.pos)
	console.error(result.message)
}
