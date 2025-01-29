import { Parser, char } from "../src"

const lol = Parser.gen(function* () {
	const a = yield* char("h")
	return { a }
})

// const lolol = Parser.gen(function* () {
// 	const b = yield* char("y")
// 	return { b }
// })

// const result = or(lol, lolol).map((s) => {
// 	if ("a" in s) {
// 		return s
// 	} else {
// 		return s.b
// 	}
// })
