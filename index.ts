import {
	alphabet,
	between,
	char,
	many1,
} from "./src/parseme/combinators"

const str = between(
	char('"'),
	char('"'),
	many1(alphabet),
).map((s) => s.join(""))

const manyStrings = between(
	char("["),
	char("]"),
	many1(str, char(",")),
)

console.log(
	manyStrings.parseOrError('["hello","world","test"]'),
)
