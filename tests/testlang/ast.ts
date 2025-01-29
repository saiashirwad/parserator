export type Expr =
	| { type: "number"; value: number }
	| { type: "string"; value: string }
	| { type: "var"; name: string }
	| { type: "add"; left: Expr; right: Expr }
	| { type: "sub"; left: Expr; right: Expr }
	| { type: "mul"; left: Expr; right: Expr }
	| { type: "div"; left: Expr; right: Expr }
	| { type: "call"; name: string; args: Expr[] }
	| { type: "fieldAccess"; obj: Expr; field: string }
	| { type: "object"; fields: [string, Expr][] }
	| { type: "lambda"; params: string[]; body: Expr }
	| { type: "let"; name: string; value: Expr; body: Expr }

export function expr(exp: Expr) {
	return exp
}
