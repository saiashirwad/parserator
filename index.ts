import {
	alphabet,
	between,
	char,
	many1,
} from "./src/parseme/combinators"

const str = between(char('"'), char('"'), many1(alphabet))

const manyStrings = between(
	char("["),
	many1(str, char(",")),
	char("]"),
)

console.log(
	manyStrings.parseOrError('["hello","world","test"]'),
)
