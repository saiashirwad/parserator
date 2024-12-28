export type Type =
	| { kind: "TNumber" }
	| { kind: "TString" }
	| { kind: "TBoolean" }
	| { kind: "TArray"; elementType: Type }
	| { kind: "TFunction"; paramTypes: Type[]; returnType: Type }
	| { kind: "TRecord"; fields: [string, Type][] }
	| { kind: "TTypeVar"; name: string }
	| { kind: "TApp"; baseType: Type; typeArgs: Type[] }

export type Expr =
	| { kind: "Number"; value: number }
	| { kind: "String"; value: string }
	| { kind: "Boolean"; value: boolean }
	| { kind: "Var"; name: string }
	| { kind: "Array"; elements: Expr[] }
	| { kind: "Call"; callee: Expr; args: Expr[] }
	| { kind: "Lambda"; params: string[]; body: Expr }
	| { kind: "Let"; name: string; value: Expr; body: Expr }
	| { kind: "If"; condition: Expr; thenBranch: Expr; elseBranch: Expr }
	| { kind: "For"; variable: string; collection: Expr; body: Expr }
	| { kind: "Block"; expressions: Expr[] }

export type Kind = { kind: "KType" } | { kind: "KFun"; from: Kind; to: Kind }

export type Decl =
	| {
			kind: "FunDecl"
			name: string
			typeParams: [string, Kind][]
			params: [string, Type][]
			returnType: Type
			body: Expr
	  }
	| {
			kind: "TraitDecl"
			name: string
			typeParams: [string, Kind][]
			methods: [string, Type][]
	  }
	| {
			kind: "ImplDecl"
			trait: string
			type: Type
			methods: [string, Expr][]
	  }
	| {
			kind: "TypeDecl"
			name: string
			typeParams: [string, Kind][]
			body: Type
	  }
