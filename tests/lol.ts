import {
	ParserError,
	constString,
	string,
	zipRight,
} from "../src"

// const lol = Parser.gen(function* () {
// 	yield* string("abc")
// 	return yield* string("def")
// })

const lol = string("abc").zipRight(string("def"))

const result = lol.parseOrError("abcdef")

if (result instanceof ParserError) {
	console.log(result.pos)
	console.error(result.message)
} else {
	console.log(result)
}
