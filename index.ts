import { convertToObject } from "typescript"
import {
	alphabet,
	char,
	lookAhead,
	many1,
	notFollowedBy,
	skipSpaces,
} from "./src/parseme/combinators"
import { Parser } from "./src/parseme/parser"

try {
	const lol = skipSpaces
		.then(char("h"))
		.thenDiscard(skipSpaces)
		.error("Oops")
	console.log(lol.run("       j"))
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
	if (e instanceof Error) {
		console.log(e.message)
	}
}
