import { Parser } from "./parseme/parser"
import {
	alphabet,
	char,
	constString,
	many,
	or,
	skipSpaces,
} from "./parseme/combinators"
import { float } from "./parseme/lexer"
import { Type } from "./syntax"

export const parseString = Parser.gen(function* () {
	yield* skipSpaces
	const result = yield* many(alphabet)
	yield* skipSpaces
	return Type("TString", { value: result.join("") })
})

export const parseNumber = float.map((value) => Type("TNumber", { value }))

export const parseBool = or(constString("true"), constString("false")).map(
	(value) => Type("TBoolean", { value: value === "true" }),
)
