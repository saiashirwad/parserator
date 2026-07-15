import {
  atomic,
  char,
  commit,
  digit,
  eof,
  many,
  many1,
  optional,
  or,
  parser,
  Parser,
  regex,
  skipMany0,
  string,
  takeUpto
} from "../src/index.ts"
import { peekAhead } from "../src/utils.ts"

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
  symbol: (name: string): LispExpr.LispExpr => ({ type: "Symbol", name }),

  number: (value: number): LispExpr.LispExpr => ({ type: "Number", value }),

  string: (value: string): LispExpr.LispExpr => ({ type: "String", value }),

  bool: (value: boolean): LispExpr.LispExpr => ({ type: "Boolean", value }),

  list: (items: LispExpr.LispExpr[]): LispExpr.LispExpr => ({
    type: "List",
    items
  }),

  if: (
    condition: LispExpr.LispExpr,
    consequent: LispExpr.LispExpr,
    alternate: LispExpr.LispExpr
  ): LispExpr.LispExpr => ({ type: "If", condition, consequent, alternate }),

  lambda: (params: string[], body: LispExpr.LispExpr): LispExpr.LispExpr => ({
    type: "Lambda",
    params,
    body
  }),

  let: (
    bindings: Array<{ name: string; value: LispExpr.LispExpr }>,
    body: LispExpr.LispExpr
  ): LispExpr.LispExpr => ({ type: "Let", bindings, body })
}

// =============================================================================
// Lexical Elements
// =============================================================================

const whitespace = regex(/\s+/).label("whitespace")
const lineComment = regex(/;[^\n]*/).label("line comment")
const space = or(whitespace, lineComment)
const spaces = skipMany0(space)

function token<T>(parser: Parser<T>): Parser<T> {
  return parser.trimLeft(spaces)
}

// =============================================================================
// Expression Parsers
// =============================================================================

// Forward declaration for recursive parsers
export let expr: Parser<LispExpr.LispExpr>

const symbol = token(
  parser(function* () {
    const name = yield* regex(/[^()\s;]+/).label("symbol name")
    if (name === "") {
      return yield* Parser.fatal("Empty symbol")
    }
    return LispExpr.symbol(name)
  })
)

const number = token(
  parser(function* () {
    const sign = (yield* optional(char("-"))) ?? ""
    const digits = yield* many1(digit).expect("Expected digit in number")
    const decimalPart = yield* optional(
      parser(function* () {
        yield* char(".")
        const fractionalDigits = yield* many1(digit).expect(
          "Expected digits after decimal point"
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
    yield* char('"').expect("closing quote for string literal")
    return LispExpr.string(value)
  })
)

const boolean = token(
  or(
    string("#t").map(() => LispExpr.bool(true)),
    string("#f").map(() => LispExpr.bool(false))
  ).label("boolean")
)

const atom = or(boolean, number, stringLiteral, symbol)

// List parsing with better error handling
const list = atomic(
  parser(function* () {
    yield* token(char("("))
    yield* commit()

    const items = yield* many(Parser.lazy(() => expr))

    yield* token(char(")")).expect("closing parenthesis ')'")
    return items
  })
)

// Special form parsers
const lambdaParser = (items: LispExpr.LispExpr[]) =>
  parser(function* () {
    if (items.length !== 3) {
      return yield* Parser.fatal(
        "Lambda requires exactly 3 elements: (lambda (params...) body)"
      )
    }

    // Safe: length === 3 checked above
    const [lambdaSymbol, paramsExpr, bodyExpr] = items as [
      LispExpr.LispExpr,
      LispExpr.LispExpr,
      LispExpr.LispExpr
    ]

    if (lambdaSymbol.type !== "Symbol" || lambdaSymbol.name !== "lambda") {
      return yield* Parser.fatal("Expected 'lambda' keyword")
    }

    if (paramsExpr.type !== "List") {
      return yield* Parser.fatal("Lambda parameters must be a list")
    }

    const params: string[] = []
    for (const param of paramsExpr.items) {
      if (param.type !== "Symbol") {
        return yield* Parser.fatal("Lambda parameters must be symbols")
      }
      params.push(param.name)
    }

    return LispExpr.lambda(params, bodyExpr)
  })

const letParser = (items: LispExpr.LispExpr[]) =>
  parser(function* () {
    if (items.length !== 3) {
      return yield* Parser.fatal(
        "Let requires exactly 3 elements: (let ((var val)...) body)"
      )
    }

    // Safe: length === 3 checked above
    const [letSymbol, bindingsExpr, bodyExpr] = items as [
      LispExpr.LispExpr,
      LispExpr.LispExpr,
      LispExpr.LispExpr
    ]

    if (letSymbol.type !== "Symbol" || letSymbol.name !== "let") {
      return yield* Parser.fatal("Expected 'let' keyword")
    }

    if (bindingsExpr.type !== "List") {
      return yield* Parser.fatal("Let bindings must be a list")
    }

    const bindings: LispExpr.Let["bindings"] = []
    for (const binding of bindingsExpr.items) {
      if (binding.type !== "List" || binding.items.length !== 2) {
        return yield* Parser.fatal(
          "Each let binding must be a list of exactly 2 elements"
        )
      }

      // Safe: length === 2 checked above
      const [nameExpr, valueExpr] = binding.items as [
        LispExpr.LispExpr,
        LispExpr.LispExpr
      ]
      if (nameExpr.type !== "Symbol") {
        return yield* Parser.fatal("Let binding name must be a symbol")
      }

      bindings.push({ name: nameExpr.name, value: valueExpr })
    }

    return LispExpr.let(bindings, bodyExpr)
  })

const ifParser = (items: LispExpr.LispExpr[]) =>
  parser(function* () {
    if (items.length !== 4) {
      return yield* Parser.fatal(
        "If requires exactly 4 elements: (if condition consequent alternate)"
      )
    }

    // Safe: length === 4 checked above
    const [ifSymbol, condition, consequent, alternate] = items as [
      LispExpr.LispExpr,
      LispExpr.LispExpr,
      LispExpr.LispExpr,
      LispExpr.LispExpr
    ]

    if (ifSymbol.type !== "Symbol" || ifSymbol.name !== "if") {
      return yield* Parser.fatal("Expected 'if' keyword")
    }

    return LispExpr.if(condition, consequent, alternate)
  })

// Enhanced list parser with special form detection
const listParser = list.flatMap(items =>
  parser(function* () {
    if (items.length === 0) {
      return yield* Parser.fatal("Empty list not allowed")
    }

    const first = items[0]! // non-empty: checked above
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
)

// Main expression parser
expr = parser(function* () {
  yield* spaces

  const isList = yield* peekAhead(1).map(x => x === "(")
  const result = yield* isList ? listParser : atom

  yield* spaces
  return result
})

// Program parser (multiple expressions)
export const program = parser(function* () {
  yield* spaces
  const expressions = yield* many(expr)
  yield* spaces
  yield* eof.expect("end of input")

  if (expressions.length === 0) {
    return yield* Parser.fatal("Expected at least one expression")
  }

  return expressions
})

// Single expression parser for REPL-style usage
export const lispParser = parser(function* () {
  yield* spaces
  const result = yield* expr
  yield* spaces
  yield* eof.expect("end of input")
  return result
})
