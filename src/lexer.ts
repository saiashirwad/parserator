import {
	char,
	digit,
	many1,
	manyN,
	optional,
	or,
	skipUntil,
} from "./combinators"
import {
	Parser,
	ParserError,
	type ParserOptions,
} from "./parser"
import {
	State,
	type ParserState,
	type SourcePosition,
} from "./state"

// // New result type that can hold both value and errors
// type RecoveryParserResult<T> = {
// 	value: T | null
// 	state: ParserState
// 	errors: ParserError[]
// 	recovered: boolean
// }

// // Enhanced error type with recovery info
// class EnhancedParserError extends ParserError {
// 	constructor(
// 		message: string,
// 		expected: string[],
// 		pos: SourcePosition,
// 		public recoveryPoint?: {
// 			type: "token" | "statement" | "expression"
// 			position: SourcePosition
// 		},
// 	) {
// 		super(message, expected, pos)
// 	}
// }

// // Modified Parser class (conceptual example)
// class RecoveryParser<T> {
// 	constructor(
// 		public parse: (
// 			state: ParserState,
// 		) => RecoveryParserResult<T>,
// 		public options?: ParserOptions & {
// 			recoveryPoints?: string[] // tokens to sync on
// 			isRecoveryPoint?: boolean // is this parser a recovery point
// 		},
// 	) {}

// 	// Example of how integer2 from your lexer might look with recovery
// 	static integer2WithRecovery = Parser.gen(function* () {
// 		try {
// 			const sign = yield* optional(char("-"))
// 			const digits = yield* manyN(digit, 2)
// 			const numStr = (sign ?? "") + digits.join("")
// 			return {
// 				value: parseInt(numStr, 10),
// 				recovered: false,
// 				errors: [],
// 			}
// 		} catch (error) {
// 			if (error instanceof ParserError) {
// 				// Try to recover by skipping until next number or delimiter
// 				const recovery = yield* skipUntil(
// 					or(digit, char(";"), char(","), char(")")),
// 				)
// 				return {
// 					value: null,
// 					recovered: true,
// 					errors: [
// 						{
// 							message:
// 								"Invalid integer, expected at least 2 digits",
// 							pos: error.pos,
// 							recoveredAt: 0,
// 						},
// 					],
// 				}
// 			}
// 		}
// 	})
// }

// export function skipWhitespace(): Parser<undefined> {
// 	return Parser.gen(function* () {
// 		while (true) {
// 			const result = yield* optional(char(" "))
// 			if (!result) {
// 				return undefined
// 			}
// 		}
// 	})
// }

// export const integer2 = Parser.gen(function* () {
// 	const sign = yield* optional(char("-"))
// 	const digits = yield* manyN(digit, 2).errorCallback(
// 		(error, state) => {
// 			console.log(state)
// 			return `WUT, i need 2 digits, minimum, at ${State.printPosition(state)}`
// 		},
// 	)
// 	const numStr = (sign ?? "") + digits.join("")
// 	return parseInt(numStr, 10)
// }).withName("integer2")

// export const float = Parser.gen(function* () {
// 	const sign = yield* optional(char("-"))
// 	const intPart = yield* many1(digit)
// 	const fractionalPart = yield* optional(
// 		Parser.gen(function* () {
// 			yield* char(".")
// 			return yield* many1(digit)
// 		}),
// 	)
// 	const exponentPart = yield* optional(
// 		Parser.gen(function* () {
// 			yield* char("e")
// 			const expSign = yield* optional(
// 				or(char("+"), char("-")),
// 			)
// 			const expDigits = yield* many1(digit)
// 			return (expSign ?? "") + expDigits.join("")
// 		}),
// 	)

// 	const numStr =
// 		(sign ?? "") +
// 		intPart.join("") +
// 		(fractionalPart ? "." + fractionalPart.join("") : "") +
// 		(exponentPart ? "e" + exponentPart : "")

// 	console.log(numStr)

// 	return parseFloat(numStr)
// })

// export const floatWithRecovery = Parser.gen(function* () {
// 	const errors: ParserError[] = []
// 	let value = null

// 	try {
// 		// Parse sign
// 		const sign = yield* optional(char("-"))

// 		// Parse integer part
// 		let intPart: string[]
// 		try {
// 			intPart = yield* many1(digit)
// 		} catch (e) {
// 			if (e instanceof ParserError) {
// 				errors.push(
// 					new EnhancedParserError(
// 						"Invalid integer part",
// 						["digits"],
// 						e.pos,
// 						{ type: "token", position: e.pos },
// 					),
// 				)
// 				// Skip until we find a dot or space
// 				const skipped = yield* skipUntil(
// 					or(char("."), char(" ")),
// 				)
// 				intPart = ["0"] // fallback value
// 			}
// 			throw e
// 		}

// 		// Parse fractional part
// 		let fractionalPart: string[] | undefined
// 		try {
// 			fractionalPart = yield* optional(
// 				Parser.gen(function* () {
// 					yield* char(".")
// 					return yield* many1(digit)
// 				}),
// 			)
// 		} catch (e) {
// 			if (e instanceof ParserError) {
// 				errors.push(
// 					new EnhancedParserError(
// 						"Malformed decimal part",
// 						["digits after decimal point"],
// 						e.pos,
// 						{ type: "token", position: e.pos },
// 					),
// 				)
// 				// Skip until we find 'e' or space
// 				yield* skipUntil(or(char("e"), char(" ")))
// 			}
// 		}

// 		// Parse exponent part
// 		let exponentPart: string | undefined
// 		try {
// 			exponentPart = yield* optional(
// 				Parser.gen(function* () {
// 					yield* char("e")
// 					const expSign = yield* optional(
// 						or(char("+"), char("-")),
// 					)
// 					const expDigits = yield* many1(digit)
// 					return (expSign ?? "") + expDigits.join("")
// 				}),
// 			)
// 		} catch (e) {
// 			if (e instanceof ParserError) {
// 				errors.push(
// 					new EnhancedParserError(
// 						"Invalid exponent",
// 						["digits after 'e'"],
// 						e.pos,
// 						{ type: "token", position: e.pos },
// 					),
// 				)
// 				// Skip until space or next number
// 				yield* skipUntil(or(char(" "), digit))
// 			}
// 		}

// 		// Construct the value if we can
// 		if (errors.length === 0) {
// 			const numStr =
// 				(sign ?? "") +
// 				intPart.join("") +
// 				(fractionalPart
// 					? "." + fractionalPart.join("")
// 					: "") +
// 				(exponentPart ? "e" + exponentPart : "")
// 			value = parseFloat(numStr)
// 		}

// 		return {
// 			value,
// 			errors,
// 			recovered: errors.length > 0,
// 		}
// 	} catch (e) {
// 		if (e instanceof ParserError) {
// 			errors.push(e)
// 		}
// 		return {
// 			value: null,
// 			errors,
// 			recovered: true,
// 		}
// 	}
// })

// const result = floatWithRecovery.run("f123.45e-6")
// console.log(result)
