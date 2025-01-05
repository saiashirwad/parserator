// import {
// 	Either,
// 	Parser,
// 	char,
// 	digit,
// 	many0,
// 	many1,
// 	or,
// 	parseUntilChar,
// } from "../../src"
// import { expr } from "./ast"

// const whitespace = many0(or(char(" "), char("\n")))

// export const testlangParser = Parser.gen(function* () {})

// const parseNumber = many1(digit).map((digits) =>
// 	expr({
// 		type: "number",
// 		value: Number(digits.join("")),
// 	}),
// )

// const parseString = char('"')
// 	.then(parseUntilChar('"'))
// 	.map((s) =>
// 		expr({
// 			type: "string",
// 			value: s,
// 		}),
// 	)

// // const result = whitespace
// // 	.then(betweenChars("(", ")", parseString))
// // 	.parse('("hi there")')

// // if (Either.isLeft(result)) {
// // 	console.error(result.left.message)
// // } else {
// // 	console.log(result.right)
// // }
