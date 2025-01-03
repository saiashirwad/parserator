import { describe, test, expect } from "bun:test"
import {
	Parser,
	alphabet,
	char,
	constString,
	digit,
	many0,
	many1,
	optional,
	or,
	skipUntil,
	string,
	skipSpaces,
} from "../src/index"
import { peekAhead } from "../src/utils"

const word = or(alphabet, char("_"))
	.zip(many1(or(alphabet, char("_"), digit)))
	.map(([first, rest]) => first + rest.join(""))

const parser = word.trim(skipSpaces)

const result = parser.run("  hello  there")

console.log(result)
