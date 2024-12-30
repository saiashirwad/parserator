import { describe, expect, test } from "bun:test"
import { Either } from "../src/either"

const ea = (): Either<number, string> =>
	Either.gen(function* () {
		const a = yield* Either.right(5)
		const b = yield* Either.right(3)
		return a + b
	})

const eb = (): Either<number, string> =>
	Either.gen(function* () {
		const a = yield* ea()
		const aa = yield* ea()
		yield* Either.left("hi")
		return a + aa
	})

describe("either", () => {
	test("either right", () => {
		const result = ea()
		expect(Either.isRight(result)).toBe(true)
	})

	test("either left", () => {
		const result = eb()
		expect(Either.isLeft(result)).toBe(true)
	})
})
