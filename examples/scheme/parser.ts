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
import { peekRemaining } from "../../src/utils"
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

const list = parser(function* () {
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

const listParser = list.map(LispExpr.list)

const lambdaParser = list.flatMap((list) =>
	parser(function* () {
		if (list.length !== 3) {
			return yield* Parser.error("Invalid lambda expression")
		}
		const [first, paramsExpr, bodyExpr] = list

		if (!(first.type === "Symbol" && first.name === "lambda")) {
			return yield* Parser.error("Invalid lambda expression")
		}

		if (!(paramsExpr.type === "List" && paramsExpr.items)) {
			return yield* Parser.error("Invalid params for lambda expression")
		}

		const params: string[] = []
		for (const item of paramsExpr.items) {
			if (item.type !== "Symbol") {
				return yield* Parser.error(
					"Invalid param definition for lambda expression",
				)
			}
			params.push(item.name)
		}

		return LispExpr.lambda(params, bodyExpr)
	}),
)

const letParser = list.flatMap((list) =>
	parser(function* () {
		if (list.length !== 3) {
			return yield* Parser.error("Invalid let expression")
		}
		const [first, bindingsExpr, bodyExpr] = list

		if (!(first.type === "Symbol" && first.name === "let")) {
			return yield* Parser.error("Invalid let expression")
		}

		if (!(bindingsExpr.type === "List" && bindingsExpr.items)) {
			return yield* Parser.error("Invalid bindings for let expression")
		}

		const bindings: LispExpr.Let["bindings"] = []
		for (const item of bindingsExpr.items) {
			if (!(item.type === "List" && item.items.length === 2)) {
				return yield* Parser.error("Invalid let expression")
			}
			const [keyExpr, valExpr] = item.items
			if (keyExpr.type !== "Symbol") {
				return yield* Parser.error("Invalid let expression")
			}
			if (!("value" in valExpr)) {
				return yield* Parser.error("Invalid let expression")
			}

			bindings.push({
				name: keyExpr.name,
				value: valExpr,
			})
		}

		return LispExpr.let(bindings, bodyExpr)
	}),
)

const atom = or(boolean, number, stringLiteral, symbol)

expr = Parser.lazy(() =>
	parser(function* () {
		yield* optionalWhitespace
		const result = yield* or(
			atom,
			lambdaParser,
			letParser,
			listParser,
		).withError(({ error, state }) => {
			return `Expected an atom or list at ${State.printPosition(state)}`
		})
		yield* optionalWhitespace
		return result
	}),
)

export const lispParser = many0(whitespace.then(expr).thenDiscard(whitespace))
