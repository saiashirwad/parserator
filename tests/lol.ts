import { Parser, char, narrowedString, or, string } from "../src"
import { peekAhead } from "../src/utils"

// const lol = Parser.gen(function* () {
// 	yield* string("abc")
// 	return yield* string("def")
// })

// const lol = string("abc").zipRight(string("def"))

// const result = lol.parseOrError("abcdef")

// if (result instanceof ParserError) {
// 	console.log(result.pos)
// 	console.error(result.message)
// } else {
// 	console.log(result)
// }

const rip = Parser.Do.bind("hi", string("hi"))
	.bind("bar", narrowedString("bar"))
	.bind("baz", narrowedString("baz"))
	.bind("rip", (ctx) => narrowedString(`${ctx.bar}${ctx.baz}`))
	.map((ctx) => {
		return ctx.rip
	})

const rip2 = Parser.gen(function* () {
	const hi = yield* string("hi")
	const bar = yield* narrowedString("bar")
	const baz = yield* narrowedString("baz")
	const rip = yield* narrowedString(`${bar}${baz}`)
	return rip
})

const lol = Parser.gen(function* () {
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

const lolol = Parser.gen(function* () {
	const b = yield* char("y")
	return { b }
})

const result = or(lol, lolol).map((s) => {
	if ("a" in s) {
		return s
	} else {
		return s.b
	}
})
