import { Parser, string } from "../../src"

const something = Parser.gen(function* () {
	const name = yield* string("name")

	return { name }
})
