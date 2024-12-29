import {
	alphabet,
	char,
	many1,
} from "./src/parseme/combinators"
import { Either } from "./src/parseme/either"
import { State } from "./src/parseme/state"

const word = char('"')
	.then(many1(alphabet))
	.thenDiscard(char('"'))
	.map((result) => result.join(""))
	.tap((state, result) => {
		console.log("\n=== Parsing Word ===")
		console.log("Position:", State.printPosition(state))
		console.log(
			"Input:",
			JSON.stringify(
				state.remaining.slice(0, 20) +
					(state.remaining.length > 20 ? "..." : ""),
			),
		)
		console.log(
			"Result:",
			Either.isRight(result)
				? `Success: "${result.right[0]}"`
				: `Error: ${result.left.message}`,
		)
		console.log("=".repeat(40))
	})
const manyStrings = many1(word, char(","))

console.log(manyStrings.run('"hello","world","test"'))
