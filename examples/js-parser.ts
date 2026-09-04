import {
  attempt,
  between,
  char,
  commit,
  eof,
  fail,
  fatal,
  many,
  notFollowedBy,
  optional,
  precedence,
  choice,
  parser,
  recursive,
  regex,
  sepBy,
  succeed,
  skipMany,
  literal
} from "../src/index.ts"
import type { Parser } from "../src/index.ts"

// =============================================================================
// Lexical Elements
// =============================================================================

const whitespace = regex(/\s+/).context("whitespace")
const lineComment = regex(/\/\/[^\r\n\u2028\u2029]*/).context("line comment")
const blockComment = regex(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//).context(
  "block comment"
)
const space = choice(whitespace, lineComment, blockComment)
const spaces = skipMany(space)

function token<T>(parser: Parser<T>): Parser<T> {
  return spaces.zipRight(parser)
}

const keywords = [
  "let",
  "const",
  "function",
  "if",
  "else",
  "return",
  "true",
  "false",
  "null"
]
const keyword = (k: string) =>
  token(literal(k).zipLeft(regex(/(?![a-zA-Z0-9_])/)))

const identifier: Parser<string> = token(
  regex(/[a-zA-Z_][a-zA-Z0-9_]*/)
    .context("identifier")
    .flatMap(name =>
      keywords.includes(name)
        ? fail(
            `'${name}' is a reserved keyword and cannot be used as an identifier`
          )
        : succeed(name)
    )
)

// Literals
const numberLiteral = token(
  regex(/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)
    .map(Number)
    .context("number")
)

const stringLiteral = token(
  choice(
    between(char('"'), char('"'), regex(/[^"]*/)),
    between(char("'"), char("'"), regex(/[^']*/))
  ).context("string")
)

const booleanLiteral = token(
  choice(
    keyword("true").map(() => true),
    keyword("false").map(() => false)
  )
).context("boolean")

const nullLiteral = token(keyword("null").map(() => null)).context("null")

// Operators
const assignmentOp = token(
  choice(
    literal("="),
    literal("+="),
    literal("-="),
    literal("*="),
    literal("/=")
  )
)
const unaryOp = token(choice(literal("!"), literal("-"), literal("+")))

// =============================================================================
// AST Types
// =============================================================================

type Expression =
  | { type: "identifier"; name: string }
  | { type: "literal"; value: any }
  | { type: "binary"; left: Expression; op: string; right: Expression }
  | { type: "unary"; op: string; arg: Expression }
  | { type: "call"; callee: Expression; args: Expression[] }
  | { type: "member"; object: Expression; property: string }
  | { type: "function"; params: string[]; body: Statement[] }
  | { type: "object"; properties: Array<{ key: string; value: Expression }> }
  | { type: "array"; elements: Expression[] }

type Statement =
  | { type: "expression"; expression: Expression }
  | {
      type: "variable"
      kind: "let" | "const"
      name: string
      init?: Expression | undefined
    }
  | { type: "function"; name: string; params: string[]; body: Statement[] }
  | {
      type: "if"
      test: Expression
      consequent: Statement
      alternate?: Statement | undefined
    }
  | { type: "return"; value?: Expression | undefined }
  | { type: "block"; body: Statement[] }

// =============================================================================
// Expression Parsers
// =============================================================================

// Forward declaration for recursive parsers
let expression: Parser<Expression>

// Primary expressions
const primaryExpression: Parser<Expression> = choice(
  // Literals
  numberLiteral.map(value => ({ type: "literal" as const, value })),
  stringLiteral.map(value => ({ type: "literal" as const, value })),
  booleanLiteral.map(value => ({ type: "literal" as const, value })),
  nullLiteral.map(value => ({ type: "literal" as const, value })),

  // Function expression
  attempt(
    parser(function* () {
      yield* keyword("function")
      yield* token(char("(")).expected("opening parenthesis after 'function'")
      const params = yield* sepBy(identifier, token(char(",")))
      yield* token(char(")")).expected("closing parenthesis")
      const body = yield* blockStatement.expected("function body")
      return { type: "function" as const, params, body: body.body }
    })
  ),

  // Identifier (after function expressions, so `function` gets its branch).
  identifier.map(name => ({ type: "identifier" as const, name })),

  // Object literal
  attempt(
    parser(function* () {
      yield* token(char("{"))
      yield* commit()
      const properties = yield* sepBy(
        parser(function* () {
          const key = yield* choice(identifier, stringLiteral).expected(
            "property key"
          )
          const hasColon = yield* optional(token(char(":")))
          const value = hasColon
            ? yield* recursive<Expression>(() => expression).expected(
                "property value"
              )
            : { type: "identifier" as const, name: key }
          return { key, value }
        }),
        token(char(","))
      )
      yield* token(char("}")).expected("closing brace for object")
      return { type: "object" as const, properties }
    })
  ),

  // Array literal
  attempt(
    parser(function* () {
      yield* token(char("["))
      yield* commit()
      const elements = yield* sepBy(
        recursive<Expression>(() => expression),
        token(char(","))
      )
      yield* token(char("]")).expected("closing bracket for array")
      return { type: "array" as const, elements }
    })
  ),

  // Parenthesized expression
  between(
    token(char("(")),
    token(char(")")),
    recursive<Expression>(() => expression)
  )
)

// Postfix expressions (function calls, member access)
const postfixExpression: Parser<Expression> = parser(function* () {
  let expr = yield* primaryExpression

  while (true) {
    const next = yield* optional(
      choice(
        // Function call
        attempt(
          parser(function* () {
            yield* token(char("("))
            const args = yield* sepBy(
              recursive<Expression>(() => expression),
              token(char(","))
            )
            yield* token(char(")")).expected(
              "closing parenthesis for function call"
            )
            return { type: "call" as const, args }
          })
        ),
        // Member access
        attempt(
          parser(function* () {
            yield* token(char("."))
            const property = yield* identifier.expected(
              "property name after '.'"
            )
            return { type: "member" as const, property }
          })
        )
      )
    )

    if (!next) break

    if (next.type === "call") {
      expr = { type: "call", callee: expr, args: next.args }
    } else {
      expr = { type: "member", object: expr, property: next.property }
    }
  }

  return expr
})

// Unary expressions
const unaryExpression: Parser<Expression> = choice(
  parser(function* () {
    const op = yield* unaryOp
    const arg = yield* unaryExpression
    return { type: "unary" as const, op, arg }
  }),
  postfixExpression
)

// Binary expressions, from tightest to loosest precedence.
const binaryOperator = <T extends string>(
  operator: Parser<T>
): Parser<(left: Expression, right: Expression) => Expression> =>
  operator.map(op => (left, right) => ({
    type: "binary" as const,
    left,
    op,
    right
  }))

const nonAssignmentOperator = <const T extends string>(
  operator: T
): Parser<T> => literal(operator).zipLeft(notFollowedBy(char("=")))

const binaryExpression: Parser<Expression> = precedence(unaryExpression, [
  {
    associativity: "left",
    operators: [
      binaryOperator(
        token(
          choice(
            nonAssignmentOperator("*"),
            nonAssignmentOperator("/"),
            literal("%")
          )
        )
      )
    ]
  },
  {
    associativity: "left",
    operators: [
      binaryOperator(
        token(choice(nonAssignmentOperator("+"), nonAssignmentOperator("-")))
      )
    ]
  },
  {
    associativity: "left",
    operators: [
      binaryOperator(
        token(choice(literal("<="), literal(">="), literal("<"), literal(">")))
      )
    ]
  },
  {
    associativity: "left",
    operators: [
      binaryOperator(
        token(
          choice(literal("==="), literal("!=="), literal("=="), literal("!="))
        )
      )
    ]
  },
  {
    associativity: "left",
    operators: [binaryOperator(token(literal("&&")))]
  },
  {
    associativity: "left",
    operators: [binaryOperator(token(literal("||")))]
  }
])

// Assignment expression
expression = parser(function* () {
  const left = yield* binaryExpression
  const assignment = yield* optional(
    parser(function* () {
      const op = yield* assignmentOp
      yield* commit() // After seeing assignment op, we're committed
      const right = yield* expression.expected(
        "expression after assignment operator"
      )
      return { op, right }
    })
  )

  if (assignment) {
    // Validate left-hand side
    if (left.type !== "identifier" && left.type !== "member") {
      return yield* fatal("Invalid assignment target")
    }
    return {
      type: "binary" as const,
      left,
      op: assignment.op,
      right: assignment.right
    }
  }

  return left
})

// =============================================================================
// Statement Parsers
// =============================================================================

let statement: Parser<Statement>

const blockStatement: Parser<Extract<Statement, { type: "block" }>> = attempt(
  parser(function* () {
    yield* token(char("{"))
    // Don't commit immediately - this could be an object literal
    const body = yield* many(recursive<Statement>(() => statement))
    yield* token(char("}")).expected("closing brace for block")
    return { type: "block" as const, body }
  })
)

const variableStatement: Parser<Statement> = parser(function* () {
  const kind = (yield* choice(keyword("let"), keyword("const"))) as
    | "let"
    | "const"

  const name = yield* identifier.expected("variable name")

  const init = yield* optional(
    parser(function* () {
      yield* token(char("="))
      return yield* expression.expected("initializer expression")
    })
  )

  if (kind === "const" && !init) {
    return yield* fatal("Missing initializer in const declaration")
  }

  yield* token(char(";")).expected("semicolon after variable declaration")

  return { type: "variable" as const, kind, name, init }
})

const functionStatement: Parser<Statement> = parser(function* () {
  yield* keyword("function")

  const name = yield* identifier.expected("function name")
  yield* token(char("(")).expected("opening parenthesis")
  const params = yield* sepBy(identifier, token(char(",")))
  yield* token(char(")")).expected("closing parenthesis")
  const body = yield* blockStatement.expected("function body")

  return { type: "function" as const, name, params, body: body.body }
})

const ifStatement: Parser<Statement> = parser(function* () {
  yield* keyword("if")

  yield* token(char("(")).expected("opening parenthesis after 'if'")
  const test = yield* expression.expected("condition expression")
  yield* token(char(")")).expected("closing parenthesis")

  const consequent = yield* statement.expected("if body")

  const alternate = yield* optional(
    parser(function* () {
      yield* keyword("else")
      return yield* statement.expected("else body")
    })
  )

  return { type: "if" as const, test, consequent, alternate }
})

const returnStatement: Parser<Statement> = parser(function* () {
  yield* keyword("return")

  const trivia = yield* many(space)
  if (trivia.some(text => /[\r\n\u2028\u2029]/u.test(text))) {
    yield* optional(char(";"))
    return { type: "return" as const, value: undefined }
  }

  const value = yield* optional(expression)

  yield* token(char(";")).expected("semicolon after return statement")

  return { type: "return" as const, value }
})

// Expression statement
const expressionStatement: Parser<Statement> = parser(function* () {
  const expr = yield* expression
  yield* token(char(";")).expected("semicolon after expression")
  return { type: "expression" as const, expression: expr }
})

statement = choice(
  blockStatement,
  variableStatement,
  functionStatement,
  ifStatement,
  returnStatement,
  expressionStatement
)

// Program parser
export const program = parser(function* () {
  yield* spaces
  const statements = yield* many(statement)
  yield* spaces
  yield* eof.expected("end of input")
  return statements
})
