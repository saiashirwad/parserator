import { expect, test } from "bun:test"
import { Parser } from "./parser"
import { alphabet, char, many1, optional, skipSpaces } from "./combinators"
import { Either } from "./either"

test("char", () => {
	const p = char("a")
	const result = p.run("a")

	if (result._tag === "Right") {
		expect(result._tag).toEqual("Right")
		expect(result.right[0]).toEqual("a")
	}
})

test("many", () => {
	const p = many1(char("a"))
	const result = p.run("aaaa")

	if (result._tag === "Right") {
		expect(result._tag).toEqual("Right")
		expect(result.right[0]).toEqual(["a", "a", "a", "a"])
	} else {
		throw new Error("Expected Right")
	}
})

test("string array", () => {
	const str = char('"')
		.zip(many1(alphabet).map((a) => a.join("")))
		.zip(char('"'))
		.map(([a, _]) => a[1])
	const strings = many1(str.zip(optional(char(","))).map(([a, _]) => a))
	const arr = char("[")
		.zip(strings)
		.zip(char("]"))
		.map(([a, _]) => a[1])

	const result = arr.run('["hello","world"]')
	console.log(result)
})
