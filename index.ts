import {
	char,
	notFollowedBy,
	skipSpaces,
	string,
} from "./src/parseme/combinators"
import { ParserError } from "./src/parseme/parser"

try {
	const lol = skipSpaces
		.then(string("hi"))
		.thenDiscard(skipSpaces)
		.map((x) => x.split(""))
		.then(notFollowedBy(char("c")))
	console.log(lol.parseOrThrow("       hi"))
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
	if (e instanceof ParserError) {
		console.log(e.message)
	}
}
