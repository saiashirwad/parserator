import {
	alphabet,
	char,
	many1,
} from "./src/parseme/combinators"
import {
	benchmark,
	debug,
	debugState,
	trace,
} from "./src/parseme/debug"

const word = benchmark(
	char('"')
		.then(many1(alphabet))
		.thenDiscard(char('"'))
		.map((result) => result.join("")),
	"Word Parser",
).tap((state, result) => debugState("Word", state, result))

// Add debug output to our parsers
const debuggedWord = debug(word, "Word")
const manyStrings = trace("Starting array parse")
	.then(many1(debuggedWord, char(",")))
	.tap((state, result) =>
		debugState("Array", state, result),
	)

console.log(manyStrings.run('"hello","world","test"'))
