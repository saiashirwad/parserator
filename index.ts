import {
	alphabet,
	between,
	char,
	many1,
} from "./src/parseme/combinators"

const word = char('"')
	.then(many1(alphabet))
	.thenDiscard(char('"'))
	.map((result) => result.join(""))

const manyStrings = between(
	char("["),
	many1(word, char(",")),
	char("]"),
)

console.log(
	manyStrings.parseOrError('["hello","world","test"]'),
)
