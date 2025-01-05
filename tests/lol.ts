import { Parser, char, createContext, or } from "../src"
import { peekAhead } from "../src/utils"

const context = createContext<{ count: number }>({
	count: 0,
})

const lol = Parser.gen(function* () {
	const ctx = yield* Parser.getContext(context)
	const a = yield* char("h")
	let count = 0
	while (true) {
		const next = yield* peekAhead(1)
		if (next === "\n") {
			return { a, count }
		}
		count++
		yield* char(next)
	}
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
