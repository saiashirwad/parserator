export namespace LispExpr {
	export type LispExpr =
		| Symbol
		| Number
		| String
		| Boolean
		| List
		| If
		| Lambda
		| Let

	export type Symbol = {
		readonly type: "Symbol"
		name: string
	}

	export type Number = {
		readonly type: "Number"
		value: number
	}

	export type String = {
		readonly type: "String"
		value: string
	}

	export type Boolean = {
		readonly type: "Boolean"
		value: boolean
	}

	export type List = {
		readonly type: "List"
		items: LispExpr[]
	}

	export type If = {
		readonly type: "If"
		condition: LispExpr
		consequent: LispExpr
		alternate: LispExpr
	}

	export type Lambda = {
		readonly type: "Lambda"
		params: string[]
		body: LispExpr
	}

	export type Let = {
		readonly type: "Let"
		bindings: Array<{ name: string; value: LispExpr }>
		body: LispExpr
	}
}

export const LispExpr = {
	symbol: (name: string): LispExpr.LispExpr => ({
		type: "Symbol",
		name,
	}),

	number: (value: number): LispExpr.LispExpr => ({
		type: "Number",
		value,
	}),

	string: (value: string): LispExpr.LispExpr => ({
		type: "String",
		value,
	}),

	bool: (value: boolean): LispExpr.LispExpr => ({
		type: "Boolean",
		value,
	}),

	list: (items: LispExpr.LispExpr[]): LispExpr.LispExpr => ({
		type: "List",
		items,
	}),

	if: (
		condition: LispExpr.LispExpr,
		consequent: LispExpr.LispExpr,
		alternate: LispExpr.LispExpr,
	): LispExpr.LispExpr => ({
		type: "If",
		condition,
		consequent,
		alternate,
	}),

	lambda: (params: string[], body: LispExpr.LispExpr): LispExpr.LispExpr => ({
		type: "Lambda",
		params,
		body,
	}),

	let: (
		bindings: Array<{
			name: string
			value: LispExpr.LispExpr
		}>,
		body: LispExpr.LispExpr,
	): LispExpr.LispExpr => ({
		type: "Let",
		bindings,
		body,
	}),
}
