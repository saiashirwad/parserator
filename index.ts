import ts from "typescript"

import { Parser } from "./src/parseme/parser"
import { alphabet, char, many, skipSpaces } from "./src/parseme/combinators"

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
	// yield* skipSpaces
	const a = yield* char("a")
	return a
})

console.log(p.run("2"))
