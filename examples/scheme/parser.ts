import {
	Parser,
	State,
	char,
	parser,
	digit,
	many0,
	many1,
	optional,
	or,
	skipMany0,
	string,
	takeUpto,
} from "../../src"
import { LispExpr } from "./ast"

const whitespace = skipMany0(or(char(" "), char("\n"), char("\t")))
const optionalWhitespace = optional(whitespace)

export let expr: Parser<LispExpr.LispExpr>

const symbol = parser(function* () {
	yield* optionalWhitespace
	const name = yield* takeUpto(
		or(char(" "), char("\n"), char("\t"), char(")"), char("(")),
	)
	yield* optionalWhitespace
	if (name === "") return yield* Parser.error("Empty symbol")
	return LispExpr.symbol(name)
})

const number = parser(function* () {
	const sign = (yield* optional(char("-"))) ?? ""
	const digits = yield* many1(digit)
	const value = parseInt(sign + digits.join(""))
	return LispExpr.number(value)
})

const stringLiteral = parser(function* () {
	yield* char('"')
	const value = yield* takeUpto(char('"'))
	yield* char('"')
	return LispExpr.string(value)
})

const boolean = parser(function* () {
	const val = yield* or(string("#t"), string("#f"))
	return LispExpr.bool(val === "#t")
})

const listParser = parser(function* () {
	yield* char("(")
	yield* optionalWhitespace

	const items = yield* many0(expr)
	if (items.length === 0) {
		return yield* Parser.error("Empty list")
	}

	yield* optionalWhitespace
	yield* char(")")
	return items
})

const lispList = listParser.map(LispExpr.list)

const letParser = listParser.flatMap((list) =>
	parser(function* () {
		if (list.length !== 3) {
			return yield* Parser.error("Invalid let expression")
		}

		let bindings: LispExpr.Let["bindings"] = []
	}),
)

const atom = or(boolean, number, stringLiteral, symbol)

expr = Parser.lazy(() =>
	parser(function* () {
		yield* optionalWhitespace
		// yield* peekRemaining
		const result = yield* or(atom, lispList).withError(({ error, state }) => {
			return `Expected an atom or list at ${State.printPosition(state)}`
		})
		yield* optionalWhitespace
		return result
	}),
)

export const lispParser = many0(whitespace.then(expr).thenDiscard(whitespace))

// while (true) {
// 	const next = yield* lookAhead(char("("))
// 	if (next !== "(") break
// 	yield* char("(")
// 	yield* optionalWhitespace
// 	const name = yield* symbol
// 	yield* optionalWhitespace
// 	const value = yield* expr
// 	yield* optionalWhitespace
// 	yield* char(")")
// 	yield* optionalWhitespace

// 	if (name.type !== "Symbol") {
// 		return yield* Parser.error(
// 			"Let binding name must be a symbol",
// 		)
// 	}
// 	bindings.push({ name: name.name, value })
// 	yield* peekRemaining
// }

// if (items[0].type === "Symbol") {
// 	// Let expression
// 	if (items[0].name === "let") {
// 		if (items.length !== 3) {
// 			return yield* Parser.error("Invalid let expression")
// 		}
// 		let bindings: LispExpr.Let["bindings"] = []
// 		if (items[1].type !== "List") {
// 			return yield* Parser.error(
// 				"Expected a list of bindings in let expression, but got " +
// 					items[1].type,
// 			)
// 		}
// 		const bindExpressions = items[1].items
// 		for (const bindExpression of bindExpressions) {
// 			if (bindExpression.type === "List") {
// 				const bind = bindExpression.items[0]
// 				const value = bindExpression.items[1]
// 				bindings.push({
// 					name: (bind as any).name,
// 					value: value as any,
// 				})
// 			}
// 		}
// 		const body = items[2]
// 		return LispExpr.let(bindings, body)
// 	}

// 	// If expression
// 	if (items[0].name === "if") {
// 		if (items.length !== 4) {
// 			return yield* Parser.error("Invalid if expression")
// 		}
// 		return LispExpr.if(items[1], items[2], items[3])
// 	}

// 	// Lambda expression
// 	if (items[0].name === "lambda") {
// 		if (items.length !== 3) {
// 			return yield* Parser.error(
// 				"Invalid lambda expression",
// 			)
// 		}
// 		const params = items[1]
// 		if (params.type !== "List") {
// 			return yield* Parser.error(
// 				"Lambda params must be a list",
// 			)
// 		}
// 		const paramNames: string[] = []
// 		for (const p of params.items) {
// 			if (p.type !== "Symbol") {
// 				return yield* Parser.error(
// 					"Lambda params must be symbols",
// 				)
// 			}
// 			paramNames.push(p.name)
// 		}
// 		return LispExpr.lambda(paramNames, items[2])
// 	}
// }
