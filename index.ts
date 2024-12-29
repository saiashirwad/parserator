import {
	alphabet,
	char,
	many1,
	notFollowedBy,
	skipSpaces,
	string,
} from "./src/parseme/combinators"
import { integer2 } from "./src/parseme/lexer"
import { ParserError } from "./src/parseme/parser"

try {
	console.log(integer2.run("hi"))
	// const word = many1(alphabet).map((x) => x.join(""))
	// const arrayOfWords = many1(word, char(","))
	// console.log(arrayOfWords.parseOrThrow("hi,hi,hi"))
	// type BC = {
	// 	b: string
	// 	c: string
	// }
	// type A = {
	// 	a: string
	// }
	// const p = Parser.gen(function* () {
	// 	const b = yield* lookAhead(char("b"))
	// 	if (b) {
	// 		yield* char("b").then(notFollowedBy(char("a")))
	// 		const c = yield* char("c").thenDiscard(char(";"))
	// 		return { b, c } as BC
	// 	} else {
	// 		const a = yield* char("a")
	// 		return { a } as A
	// 	}
	// })
	// console.log(p.run("bc;"))
} catch (e) {
	console.log(e)
}
