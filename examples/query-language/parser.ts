import {
  between,
  choice,
  createLexemes,
  literal,
  notFollowedBy,
  parser,
  precedence,
  recursive,
  regex,
  type Parser
} from "../../src/index.ts"
import {
  Query,
  type ComparisonOperator,
  type Query as QueryNode,
  type Value
} from "./ast.ts"

const lex = createLexemes({
  trivia: regex(/[ \t\r\n]*/),
  identifier: regex(/[A-Za-z_][A-Za-z0-9_.]*/),
  keywords: ["AND", "OR"] as const
})

/** The lexical layer is exported so applications can reuse its keyword rules. */
export const queryLexemes = lex

const quotedValue: Parser<string> = lex.token(
  between(literal('"'), literal('"'), regex(/[^"\\]*/))
)

const bareValue: Parser<string> = lex.token(regex(/[A-Za-z0-9_./-]+/))
const numberValue: Parser<number> = lex
  .token(
    regex(/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?/).zipLeft(
      notFollowedBy(regex(/[A-Za-z0-9_./-]/))
    )
  )
  .map(Number)
const value: Parser<Value> = choice(numberValue, quotedValue, bareValue)
  .expected("query value")
  .context("comparison")

const comparisonOperator: Parser<ComparisonOperator> = choice(
  lex.symbol(">=").map(() => ">=" as const),
  lex.symbol("<=").map(() => "<=" as const),
  lex.symbol("!=").map(() => "!=" as const),
  lex.symbol(":").map(() => ":" as const),
  lex.symbol("=").map(() => "=" as const),
  lex.symbol(">").map(() => ">" as const),
  lex.symbol("<").map(() => "<" as const)
)

const comparison: Parser<QueryNode> = parser(function* () {
  const field = yield* lex.identifier
  const operator = yield* comparisonOperator
  const parsedValue = yield* value
  return Query.comparison(field, operator, parsedValue)
})

const expression: Parser<QueryNode> = recursive(self => {
  const grouped = between(lex.symbol("("), lex.symbol(")"), self).context(
    "parenthesized expression"
  )
  const atom = choice(comparison, grouped)
  const andOperator = lex
    .keyword("AND")
    .map(
      () => (left: QueryNode, right: QueryNode) =>
        Query.logical("AND", left, right)
    )
  const orOperator = lex
    .keyword("OR")
    .map(
      () => (left: QueryNode, right: QueryNode) =>
        Query.logical("OR", left, right)
    )
  return precedence(atom, [
    { associativity: "left", operators: [andOperator] },
    { associativity: "left", operators: [orOperator] }
  ])
})

/** A complete, whitespace-tolerant query parser. */
export const query: Parser<QueryNode> = lex.complete(expression)

export { expression }
