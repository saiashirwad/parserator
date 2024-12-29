import { char, lookAhead, notFollowedBy } from "./src/parseme/combinators"
import { Parser } from "./src/parseme/parser"

// const lol = Parser.gen(function* () {
// 	const a = yield* parseString
// 	yield* skipSpaces
// 	const b = yield* parseBool
// 	yield* skipSpaces
// 	const c = yield* parseNumber

// 	return { a, b, c }
// })

// const result = lol.run('"hello" true 123')

// if (result._tag === "Right") {
// 	console.log(result.right[0])
// } else {
// 	console.log(result.left)
// }

const p = Parser.gen(function* () {
	const b = yield* lookAhead(char("b"))
	if (b) {
		yield* char("b").thenRight(notFollowedBy(char("a")))
		// yield* notFollowedBy(char("a"))
		console.log("haha")
		return { b }
	} else {
		const a = yield* char("a")
		return { a }
	}
})

console.log(p.run("ba"))
