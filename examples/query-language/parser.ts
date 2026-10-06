import {
  between,
  choice,
  createLexemes,
  eof,
  fail,
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

const logicalOperators = ["AND", "OR"] as const

const lex = createLexemes({
  trivia: regex(/[ \t\r\n]*/),
  identifier: /[A-Za-z_][A-Za-z0-9_.]*/,
  keywords: logicalOperators
})

export { lex as queryLexemes }

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
  lex.symbol(">="),
  lex.symbol("<="),
  lex.symbol("!="),
  lex.symbol(":"),
  lex.symbol("="),
  lex.symbol(">"),
  lex.symbol("<")
)

const comparison: Parser<QueryNode> = parser(function* () {
  const field = yield* lex.identifier
  const operator = yield* comparisonOperator
  const parsedValue = yield* value
  return Query.comparison(field, operator, parsedValue)
})

const expressionBody: Parser<QueryNode> = recursive(self => {
  const grouped = between(lex.symbol("("), lex.symbol(")"), self).context(
    "parenthesized expression"
  )
  const atom = choice(comparison, grouped)
  return precedence(
    atom,
    logicalOperators.map(operator => ({
      associativity: "left",
      operator: lex
        .keyword(operator)
        .map(
          () => (left: QueryNode, right: QueryNode) =>
            Query.logical(operator, left, right)
        )
    }))
  )
})

const expectedOperator = choice(lex.keyword("AND"), lex.keyword("OR")).flatMap(
  word => fail(`Unexpected trailing keyword ${JSON.stringify(word)}`)
)

export const expression: Parser<QueryNode> = expressionBody.zipLeft(
  choice(expectedOperator, eof)
)

export const query: Parser<QueryNode> = lex
  .complete(expression)
  .context("query")
