import { expr } from "./ast"

export const expr1 = expr({
	type: "let",
	name: "x",
	value: { type: "number", value: 10 },
	body: {
		type: "let",
		name: "y",
		value: { type: "number", value: 5 },
		body: {
			type: "call",
			name: "add",
			args: [
				{ type: "var", name: "x" },
				{ type: "var", name: "y" },
			],
		},
	},
})

export const code1 = `
let x = 10 in
let y = 5 in
x + y * 2
`

export const expr2 = expr({
	type: "let",
	name: "x",
	value: { type: "number", value: 10 },
	body: { type: "var", name: "x" },
})

export const code2 = `
let x = 10 in
x
`

export const expr3 = expr({
	type: "let",
	name: "point",
	value: {
		type: "object",
		fields: [
			["x", { type: "number", value: 10 }],
			["y", { type: "number", value: 20 }],
		],
	},
	body: {
		type: "fieldAccess",
		obj: { type: "var", name: "point" },
		field: "x",
	},
})

export const code3 = `
let point = { x: 10, y: 20 } in
point.x
`

export const expr4 = expr({
	type: "let",
	name: "add",
	value: {
		type: "lambda",
		params: ["a", "b"],
		body: {
			type: "add",
			left: { type: "var", name: "a" },
			right: { type: "var", name: "b" },
		},
	},
	body: {
		type: "call",
		name: "add",
		args: [
			{ type: "number", value: 3 },
			{ type: "number", value: 5 },
		],
	},
})

export const code4 = `
let add = \a b -> a + b in
add(3, 5)
`
