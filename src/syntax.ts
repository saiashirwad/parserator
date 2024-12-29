type TNumber = { tag: "TNumber"; value: { value: number } }
type TString = { tag: "TString"; value: { value: string } }
type TBoolean = {
	tag: "TBoolean"
	value: { value: boolean }
}
type TArray = { tag: "TArray"; value: { elements: Type[] } }
type TFunction = {
	tag: "TFunction"
	value: { params: Type[]; returnType: Type }
}
type TRecord = {
	tag: "TRecord"
	value: { fields: [string, Type][] }
}
type TTypeVar = { tag: "TTypeVar"; value: { name: string } }
type TApp = {
	tag: "TApp"
	value: { baseType: Type; typeArgs: Type[] }
}

type Type =
	| TNumber
	| TString
	| TBoolean
	| TArray
	| TFunction
	| TRecord
	| TTypeVar
	| TApp

export function Type<T extends Type["tag"]>(
	tag: T,
	value: Extract<Type, { tag: T }>["value"],
): Type {
	return { tag, value } as Type
}

type NumberExpr = {
	tag: "Number"
	value: { value: number }
}
type StringExpr = {
	tag: "String"
	value: { value: string }
}
type BooleanExpr = {
	tag: "Boolean"
	value: { value: boolean }
}
type VarExpr = { tag: "Var"; value: { name: string } }
type ArrayExpr = {
	tag: "Array"
	value: { elements: Expr[] }
}
type CallExpr = {
	tag: "Call"
	value: { callee: Expr; args: Expr[] }
}
type LambdaExpr = {
	tag: "Lambda"
	value: { params: string[]; body: Expr }
}
type LetExpr = {
	tag: "Let"
	value: { name: string; value: Expr; body: Expr }
}
type IfExpr = {
	tag: "If"
	value: {
		condition: Expr
		thenBranch: Expr
		elseBranch: Expr
	}
}
type ForExpr = {
	tag: "For"
	value: { variable: string; collection: Expr; body: Expr }
}
type BlockExpr = {
	tag: "Block"
	value: { expressions: Expr[] }
}

export type Expr =
	| NumberExpr
	| StringExpr
	| BooleanExpr
	| VarExpr
	| ArrayExpr
	| CallExpr
	| LambdaExpr
	| LetExpr
	| IfExpr
	| ForExpr
	| BlockExpr

export function Expr<T extends Expr["tag"]>(
	tag: T,
	value: Extract<Expr, { tag: T }>["value"],
): Expr {
	return { tag, value } as Expr
}

type KType = { tag: "KType"; value: {} }
type KFun = { tag: "KFun"; value: { from: Kind; to: Kind } }

export type Kind = KType | KFun

export function Kind<T extends Kind["tag"]>(
	tag: T,
	value: Extract<Kind, { tag: T }>["value"],
): Kind {
	return { tag, value } as Kind
}

type FunDecl = {
	tag: "FunDecl"
	value: {
		name: string
		typeParams: [string, Kind][]
		params: [string, Type][]
		returnType: Type
		body: Expr
	}
}

type TraitDecl = {
	tag: "TraitDecl"
	value: {
		name: string
		typeParams: [string, Kind][]
		methods: [string, Type][]
	}
}

type ImplDecl = {
	tag: "ImplDecl"
	value: {
		trait: string
		type: Type
		methods: [string, Expr][]
	}
}

type TypeDecl = {
	tag: "TypeDecl"
	value: {
		name: string
		typeParams: [string, Kind][]
		body: Type
	}
}

export type Decl = FunDecl | TraitDecl | ImplDecl | TypeDecl

export function Decl<T extends Decl["tag"]>(
	tag: T,
	value: Extract<Decl, { tag: T }>["value"],
): Decl {
	return { tag, value } as Decl
}
