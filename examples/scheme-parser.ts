import {
  attempt,
  char,
  choice,
  commit,
  digit,
  eof,
  fatal,
  literal,
  lookahead,
  many,
  many1,
  optional,
  parser,
  regex,
  skipMany,
  takeUpto
} from "../src/index.ts"
import type { Parser } from "../src/index.ts"

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

  export type Symbol = { readonly type: "Symbol"; name: string }

  export type Number = { readonly type: "Number"; value: number }

  export type String = { readonly type: "String"; value: string }

  export type Boolean = { readonly type: "Boolean"; value: boolean }

  export type List = { readonly type: "List"; items: LispExpr[] }

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
  symbol: (name: string): LispExpr.Symbol => ({ type: "Symbol", name }),

  number: (value: number): LispExpr.Number => ({ type: "Number", value }),

  string: (value: string): LispExpr.String => ({ type: "String", value }),

  bool: (value: boolean): LispExpr.Boolean => ({ type: "Boolean", value }),

  list: (items: LispExpr.LispExpr[]): LispExpr.List => ({
    type: "List",
    items
  }),

  if: (
    condition: LispExpr.LispExpr,
    consequent: LispExpr.LispExpr,
    alternate: LispExpr.LispExpr
  ): LispExpr.If => ({ type: "If", condition, consequent, alternate }),

  lambda: (params: string[], body: LispExpr.LispExpr): LispExpr.Lambda => ({
    type: "Lambda",
    params,
    body
  }),

  let: (
    bindings: Array<{ name: string; value: LispExpr.LispExpr }>,
    body: LispExpr.LispExpr
  ): LispExpr.Let => ({ type: "Let", bindings, body })
}

const whitespace = regex(/\s+/).context("whitespace")

const lineComment = regex(/;[^\n]*/).context("line comment")

const space = choice(whitespace, lineComment)

const spaces = skipMany(space)

function token<T>(inner: Parser<T>): Parser<T> {
  return spaces.zipRight(inner)
}

const symbol = token(
  regex(/[^()\s;]+/)
    .context("symbol name")
    .map(LispExpr.symbol)
)

const number = token(
  parser(function* () {
    const sign = (yield* optional(char("-"))) ?? ""
    const digits = yield* many1(digit).expected("digit in number")
    const decimalPart = yield* optional(
      parser(function* () {
        yield* char(".")
        const fractionalDigits = yield* many1(digit).expected(
          "digits after decimal point"
        )
        return "." + fractionalDigits.join("")
      })
    )

    const numberStr = sign + digits.join("") + (decimalPart ?? "")
    const value = parseFloat(numberStr)
    return LispExpr.number(value)
  })
)

const stringLiteral = token(
  parser(function* () {
    yield* char('"')
    yield* commit()

    const value = yield* takeUpto(char('"'))
    yield* char('"').expected("closing quote for string literal")
    return LispExpr.string(value)
  })
)

const boolean = token(
  choice(
    literal("#t").map(() => LispExpr.bool(true)),
    literal("#f").map(() => LispExpr.bool(false))
  ).context("boolean")
)

const atom = choice(boolean, number, stringLiteral, symbol)

export const expr: Parser<LispExpr.LispExpr> = parser(function* () {
  yield* spaces

  const isList = (yield* optional(lookahead(char("(")))) !== undefined
  const result = yield* isList ? listParser : atom

  yield* spaces
  return result
})

const list = attempt(
  parser(function* () {
    yield* token(char("("))
    yield* commit()

    const items = yield* many(expr)

    yield* token(char(")")).expected("closing parenthesis ')'")
    return items
  })
)

const lambdaParser = (items: LispExpr.LispExpr[]) =>
  parser(function* () {
    const [, paramsExpr, bodyExpr] = items
    if (
      items.length !== 3 ||
      paramsExpr === undefined ||
      bodyExpr === undefined
    ) {
      return yield* fatal(
        "Lambda requires exactly 3 elements: (lambda (params...) body)"
      )
    }

    if (paramsExpr.type !== "List") {
      return yield* fatal("Lambda parameters must be a list")
    }

    const params: string[] = []
    for (const param of paramsExpr.items) {
      if (param.type !== "Symbol") {
        return yield* fatal("Lambda parameters must be symbols")
      }
      params.push(param.name)
    }

    return LispExpr.lambda(params, bodyExpr)
  })

const letParser = (items: LispExpr.LispExpr[]) =>
  parser(function* () {
    const [, bindingsExpr, bodyExpr] = items
    if (
      items.length !== 3 ||
      bindingsExpr === undefined ||
      bodyExpr === undefined
    ) {
      return yield* fatal(
        "Let requires exactly 3 elements: (let ((var val)...) body)"
      )
    }

    if (bindingsExpr.type !== "List") {
      return yield* fatal("Let bindings must be a list")
    }

    const bindings: LispExpr.Let["bindings"] = []
    for (const binding of bindingsExpr.items) {
      if (binding.type !== "List") {
        return yield* fatal(
          "Each let binding must be a list of exactly 2 elements"
        )
      }

      const [nameExpr, valueExpr] = binding.items
      if (
        binding.items.length !== 2 ||
        nameExpr === undefined ||
        valueExpr === undefined
      ) {
        return yield* fatal(
          "Each let binding must be a list of exactly 2 elements"
        )
      }
      if (nameExpr.type !== "Symbol") {
        return yield* fatal("Let binding name must be a symbol")
      }

      bindings.push({ name: nameExpr.name, value: valueExpr })
    }

    return LispExpr.let(bindings, bodyExpr)
  })

const ifParser = (items: LispExpr.LispExpr[]) =>
  parser(function* () {
    const [, condition, consequent, alternate] = items
    if (
      items.length !== 4 ||
      condition === undefined ||
      consequent === undefined ||
      alternate === undefined
    ) {
      return yield* fatal(
        "If requires exactly 4 elements: (if condition consequent alternate)"
      )
    }

    return LispExpr.if(condition, consequent, alternate)
  })

const listParser = parser(function* () {
  const items = yield* list
  const [first] = items
  if (first === undefined) {
    return yield* fatal("Empty list not allowed")
  }

  if (first.type === "Symbol") {
    switch (first.name) {
      case "lambda":
        return yield* lambdaParser(items)
      case "let":
        return yield* letParser(items)
      case "if":
        return yield* ifParser(items)
    }
  }

  return LispExpr.list(items)
})

export const program = parser(function* () {
  yield* spaces
  const expressions = yield* many(expr)
  yield* spaces
  yield* eof.expected("end of input")

  if (expressions.length === 0) {
    return yield* fatal("Expected at least one expression")
  }

  return expressions
})

export const lispParser = parser(function* () {
  yield* spaces
  const result = yield* expr
  yield* spaces
  yield* eof.expected("end of input")
  return result
})
