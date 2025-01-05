import { Parser, narrowedString, string } from "../src"

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
	.bind("rip", (ctx) =>
		narrowedString(`${ctx.bar}${ctx.baz}`),
	)
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

// const rip2 = Parser.gen(function* () {
// 	const hi = yield* many1(alphabet).map((s) => s.join(""))
// 	yield* skipSpaces
// 	const bar = yield* narrowedString("bar")
// 	yield* skipSpaces
// 	const baz = yield* narrowedString("baz")
// 	yield* skipSpaces
// 	if (hi === "rip") {
// 		yield* string("rip")
// 	}
// 	const rip = yield* narrowedString(`${bar}${baz}`)
// 	return rip
// })

// const result = rip2.parse("hi bar baz barbaz")

// if (Either.isLeft(result)) {
// 	console.error(result.left.message)
// } else {
// 	console.log(result.right)
// }
