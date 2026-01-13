// ToyML AST Types
// An ML-like language without modules

// Literals

export type Literal =
  | { readonly tag: "Int"; value: number }
  | { readonly tag: "Float"; value: number }
  | { readonly tag: "Char"; value: string }
  | { readonly tag: "String"; value: string }
  | { readonly tag: "Bool"; value: boolean }
  | { readonly tag: "Unit" };

export const Literal = {
  int: (value: number): Literal => ({ tag: "Int", value }),
  float: (value: number): Literal => ({ tag: "Float", value }),
  char: (value: string): Literal => ({ tag: "Char", value }),
  string: (value: string): Literal => ({ tag: "String", value }),
  bool: (value: boolean): Literal => ({ tag: "Bool", value }),
  unit: (): Literal => ({ tag: "Unit" })
};

// Patterns (for let bindings and match expressions)

export type Pattern =
  | { readonly tag: "PWildcard" }
  | { readonly tag: "PVar"; name: string }
  | { readonly tag: "PLit"; literal: Literal }
  | { readonly tag: "PTuple"; patterns: Pattern[] }
  | { readonly tag: "PList"; patterns: Pattern[] }
  | { readonly tag: "PCons"; head: Pattern; tail: Pattern }
  | { readonly tag: "PConstructor"; name: string; args: Pattern[] }
  | { readonly tag: "PAs"; pattern: Pattern; alias: string }
  | { readonly tag: "POr"; left: Pattern; right: Pattern }
  | { readonly tag: "PAnnotated"; pattern: Pattern; type: Type };

export const Pattern = {
  wildcard: (): Pattern => ({ tag: "PWildcard" }),
  var: (name: string): Pattern => ({ tag: "PVar", name }),
  lit: (literal: Literal): Pattern => ({ tag: "PLit", literal }),
  tuple: (patterns: Pattern[]): Pattern => ({ tag: "PTuple", patterns }),
  list: (patterns: Pattern[]): Pattern => ({ tag: "PList", patterns }),
  cons: (head: Pattern, tail: Pattern): Pattern => ({
    tag: "PCons",
    head,
    tail
  }),
  constructor: (name: string, args: Pattern[]): Pattern => ({
    tag: "PConstructor",
    name,
    args
  }),
  as: (pattern: Pattern, alias: string): Pattern => ({
    tag: "PAs",
    pattern,
    alias
  }),
  or: (left: Pattern, right: Pattern): Pattern => ({ tag: "POr", left, right }),
  annotated: (pattern: Pattern, type: Type): Pattern => ({
    tag: "PAnnotated",
    pattern,
    type
  })
};

// Types

export type Type =
  | { readonly tag: "TConst"; name: string }
  | { readonly tag: "TVar"; name: string }
  | { readonly tag: "TArrow"; from: Type; to: Type }
  | { readonly tag: "TTuple"; types: Type[] }
  | { readonly tag: "TApp"; constructor: Type; args: Type[] }
  | { readonly tag: "TList"; element: Type };

export const Type = {
  const: (name: string): Type => ({ tag: "TConst", name }),
  var: (name: string): Type => ({ tag: "TVar", name }),
  arrow: (from: Type, to: Type): Type => ({ tag: "TArrow", from, to }),
  tuple: (types: Type[]): Type => ({ tag: "TTuple", types }),
  app: (constructor: Type, args: Type[]): Type => ({
    tag: "TApp",
    constructor,
    args
  }),
  list: (element: Type): Type => ({ tag: "TList", element }),

  // Common type constructors
  int: (): Type => Type.const("int"),
  float: (): Type => Type.const("float"),
  bool: (): Type => Type.const("bool"),
  string: (): Type => Type.const("string"),
  char: (): Type => Type.const("char"),
  unit: (): Type => Type.const("unit")
};

// Expressions

export type Expr =
  | { readonly tag: "ELit"; literal: Literal }
  | { readonly tag: "EVar"; name: string }
  | { readonly tag: "EConstructor"; name: string }
  | { readonly tag: "ETuple"; elements: Expr[] }
  | { readonly tag: "EList"; elements: Expr[] }
  | { readonly tag: "ERecord"; fields: Array<{ label: string; value: Expr }> }
  | { readonly tag: "ERecordAccess"; record: Expr; label: string }
  | {
      readonly tag: "ERecordUpdate";
      record: Expr;
      updates: Array<{ label: string; value: Expr }>;
    }
  | { readonly tag: "EApp"; func: Expr; arg: Expr }
  | { readonly tag: "EInfix"; left: Expr; op: string; right: Expr }
  | { readonly tag: "EPrefix"; op: string; arg: Expr }
  | { readonly tag: "EIf"; cond: Expr; then: Expr; else: Expr }
  | { readonly tag: "EMatch"; scrutinee: Expr; cases: MatchCase[] }
  | { readonly tag: "ELet"; binding: LetBinding; body: Expr }
  | { readonly tag: "ELetRec"; bindings: LetBinding[]; body: Expr }
  | { readonly tag: "EFun"; params: Pattern[]; body: Expr }
  | { readonly tag: "ESequence"; first: Expr; second: Expr }
  | { readonly tag: "EAnnotated"; expr: Expr; type: Type };

export type MatchCase = {
  pattern: Pattern;
  guard?: Expr;
  body: Expr;
};

export type LetBinding = {
  pattern: Pattern;
  params: Pattern[];
  annotation?: Type;
  value: Expr;
};

export const Expr = {
  lit: (literal: Literal): Expr => ({ tag: "ELit", literal }),
  var: (name: string): Expr => ({ tag: "EVar", name }),
  constructor: (name: string): Expr => ({ tag: "EConstructor", name }),
  tuple: (elements: Expr[]): Expr => ({ tag: "ETuple", elements }),
  list: (elements: Expr[]): Expr => ({ tag: "EList", elements }),
  record: (fields: Array<{ label: string; value: Expr }>): Expr => ({
    tag: "ERecord",
    fields
  }),
  recordAccess: (record: Expr, label: string): Expr => ({
    tag: "ERecordAccess",
    record,
    label
  }),
  recordUpdate: (
    record: Expr,
    updates: Array<{ label: string; value: Expr }>
  ): Expr => ({
    tag: "ERecordUpdate",
    record,
    updates
  }),
  app: (func: Expr, arg: Expr): Expr => ({ tag: "EApp", func, arg }),
  infix: (left: Expr, op: string, right: Expr): Expr => ({
    tag: "EInfix",
    left,
    op,
    right
  }),
  prefix: (op: string, arg: Expr): Expr => ({ tag: "EPrefix", op, arg }),
  if: (cond: Expr, then_: Expr, else_: Expr): Expr => ({
    tag: "EIf",
    cond,
    then: then_,
    else: else_
  }),
  match: (scrutinee: Expr, cases: MatchCase[]): Expr => ({
    tag: "EMatch",
    scrutinee,
    cases
  }),
  let: (binding: LetBinding, body: Expr): Expr => ({
    tag: "ELet",
    binding,
    body
  }),
  letRec: (bindings: LetBinding[], body: Expr): Expr => ({
    tag: "ELetRec",
    bindings,
    body
  }),
  fun: (params: Pattern[], body: Expr): Expr => ({ tag: "EFun", params, body }),
  sequence: (first: Expr, second: Expr): Expr => ({
    tag: "ESequence",
    first,
    second
  }),
  annotated: (expr: Expr, type: Type): Expr => ({
    tag: "EAnnotated",
    expr,
    type
  }),

  // Convenience constructors
  int: (n: number): Expr => Expr.lit(Literal.int(n)),
  float: (n: number): Expr => Expr.lit(Literal.float(n)),
  bool: (b: boolean): Expr => Expr.lit(Literal.bool(b)),
  string: (s: string): Expr => Expr.lit(Literal.string(s)),
  char: (c: string): Expr => Expr.lit(Literal.char(c)),
  unit: (): Expr => Expr.lit(Literal.unit())
};

// Type Definitions

export type TypeParam = string;

export type ConstructorDef = {
  name: string;
  args: Type[];
};

export type TypeDef =
  | { readonly tag: "Alias"; params: TypeParam[]; name: string; type: Type }
  | {
      readonly tag: "Variant";
      params: TypeParam[];
      name: string;
      constructors: ConstructorDef[];
    }
  | {
      readonly tag: "Record";
      params: TypeParam[];
      name: string;
      fields: Array<{ label: string; type: Type; mutable: boolean }>;
    };

export const TypeDef = {
  alias: (params: TypeParam[], name: string, type: Type): TypeDef => ({
    tag: "Alias",
    params,
    name,
    type
  }),
  variant: (
    params: TypeParam[],
    name: string,
    constructors: ConstructorDef[]
  ): TypeDef => ({
    tag: "Variant",
    params,
    name,
    constructors
  }),
  record: (
    params: TypeParam[],
    name: string,
    fields: Array<{ label: string; type: Type; mutable: boolean }>
  ): TypeDef => ({
    tag: "Record",
    params,
    name,
    fields
  })
};

// Top-level Declarations

export type Declaration =
  | { readonly tag: "DLet"; recursive: boolean; bindings: LetBinding[] }
  | { readonly tag: "DType"; definitions: TypeDef[] }
  | { readonly tag: "DException"; name: string; args: Type[] };

export const Declaration = {
  let: (recursive: boolean, bindings: LetBinding[]): Declaration => ({
    tag: "DLet",
    recursive,
    bindings
  }),
  type: (definitions: TypeDef[]): Declaration => ({
    tag: "DType",
    definitions
  }),
  exception: (name: string, args: Type[]): Declaration => ({
    tag: "DException",
    name,
    args
  })
};

// Program

export type Program = Declaration[];
