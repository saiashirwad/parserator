export type Expr =
	| { type: "Lit"; value: number }
	| { type: "StrLit"; value: string }
	| { type: "Var"; name: string }
	| { type: "Add"; left: Expr; right: Expr }
	| { type: "Sub"; left: Expr; right: Expr }
	| { type: "Mul"; left: Expr; right: Expr }
	| { type: "Div"; left: Expr; right: Expr }
	| { type: "Call"; name: string; args: Expr[] }
	| { type: "FieldAccess"; obj: Expr; field: string }
	| { type: "Object"; fields: [string, Expr][] }
	| { type: "Lambda"; params: string[]; body: Expr }
	| { type: "Let"; name: string; value: Expr; body: Expr }

export const expr1: Expr = {
	type: "Let",
	name: "x",
	value: { type: "Lit", value: 10 },
	body: {
		type: "Let",
		name: "y",
		value: { type: "Lit", value: 5 },
		body: {
			type: "Call",
			name: "add",
			args: [
				{ type: "Var", name: "x" },
				{ type: "Var", name: "y" },
			],
		},
	},
}

export const code1 = `
let x = 10 in
let y = 5 in
x + y * 2
`

export const expr2: Expr = {
	type: "Let",
	name: "x",
	value: { type: "Lit", value: 10 },
	body: { type: "Var", name: "x" },
}

export const code2 = `
let x = 10 in
x
`

export const expr3: Expr = {
	type: "Let",
	name: "point",
	value: {
		type: "Object",
		fields: [
			["x", { type: "Lit", value: 10 }],
			["y", { type: "Lit", value: 20 }],
		],
	},
	body: {
		type: "FieldAccess",
		obj: { type: "Var", name: "point" },
		field: "x",
	},
}

export const code3 = `
let point = { x: 10, y: 20 } in
point.x
`

export const expr4: Expr = {
	type: "Let",
	name: "add",
	value: {
		type: "Lambda",
		params: ["a", "b"],
		body: {
			type: "Add",
			left: { type: "Var", name: "a" },
			right: { type: "Var", name: "b" },
		},
	},
	body: {
		type: "Call",
		name: "add",
		args: [
			{ type: "Lit", value: 3 },
			{ type: "Lit", value: 5 },
		],
	},
}

export const code4 = `
let add = \a b -> a + b in
add(3, 5)
`
