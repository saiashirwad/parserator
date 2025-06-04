import {
  atomic,
  between,
  char,
  commit,
  Either,
  eof,
  ErrorFormatter,
  many,
  optional,
  or,
  parser,
  Parser,
  regex,
  sepBy,
  skipMany0,
  string
} from "../src";

// =============================================================================
// Lexical Elements
// =============================================================================

const whitespace = regex(/\s+/).label("whitespace");
const lineComment = regex(/\/\/[^\n]*/).label("line comment");
const blockComment = regex(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//).label("block comment");
const space = or(whitespace, lineComment, blockComment);
const spaces = skipMany0(space);

function token<T>(parser: Parser<T>): Parser<T> {
  return parser.trimLeft(spaces);
}

const keywords = ["let", "const", "function", "if", "else", "return", "true", "false", "null"];
const keyword = (k: string) => token(string(k).thenDiscard(regex(/(?![a-zA-Z0-9_])/))).commit();

const identifier = token(
  regex(/[a-zA-Z_][a-zA-Z0-9_]*/)
    .label("identifier")
    .flatMap(name =>
      keywords.includes(name) ?
        Parser.error(`'${name}' is a reserved keyword and cannot be used as an identifier`)
      : Parser.lift(name)
    )
);

// Literals
const numberLiteral = token(
  regex(/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)
    .map(Number)
    .label("number")
);

const stringLiteral = token(
  or(
    between(char('"'), char('"'), regex(/[^"]*/)),
    between(char("'"), char("'"), regex(/[^']*/))
  ).label("string")
);

const booleanLiteral = token(
  or(
    keyword("true").map(() => true),
    keyword("false").map(() => false)
  )
).label("boolean");

const nullLiteral = token(keyword("null").map(() => null)).label("null");

// Operators
const assignmentOp = token(or(string("="), string("+="), string("-="), string("*="), string("/=")));
const binaryOp = token(
  or(
    string("==="),
    string("!=="),
    string("=="),
    string("!="),
    string("<="),
    string(">="),
    string("<"),
    string(">"),
    string("&&"),
    string("||"),
    string("+"),
    string("-"),
    string("*"),
    string("/"),
    string("%")
  )
);
const unaryOp = token(or(string("!"), string("-"), string("+")));

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
  | { type: "array"; elements: Expression[] };

type Statement =
  | { type: "expression"; expression: Expression }
  | { type: "variable"; kind: "let" | "const"; name: string; init?: Expression }
  | { type: "function"; name: string; params: string[]; body: Statement[] }
  | { type: "if"; test: Expression; consequent: Statement; alternate?: Statement }
  | { type: "return"; value?: Expression }
  | { type: "block"; body: Statement[] };

// =============================================================================
// Expression Parsers
// =============================================================================

// Forward declaration for recursive parsers
let expression: Parser<Expression>;

// Primary expressions
const primaryExpression: Parser<Expression> = or(
  // Literals
  numberLiteral.map(value => ({ type: "literal" as const, value })),
  stringLiteral.map(value => ({ type: "literal" as const, value })),
  booleanLiteral.map(value => ({ type: "literal" as const, value })),
  nullLiteral.map(value => ({ type: "literal" as const, value })),

  // Identifier
  identifier.map(name => ({ type: "identifier" as const, name })),

  // Function expression
  atomic(
    Parser.gen(function* () {
      yield* keyword("function");
      yield* commit();
      yield* token(char("(")).expect("opening parenthesis after 'function'");
      const params = yield* sepBy(identifier, token(char(",")));
      yield* token(char(")")).expect("closing parenthesis");
      const body = yield* blockStatement.expect("function body");
      return {
        type: "function" as const,
        params,
        body: (body as { type: "block"; body: Statement[] }).body
      };
    })
  ),

  // Object literal
  atomic(
    Parser.gen(function* () {
      yield* token(char("{"));
      yield* commit();
      const properties = yield* sepBy(
        Parser.gen(function* () {
          const key = yield* or(identifier, stringLiteral).expect("property key");
          // Check if we have a colon (for key: value syntax)
          const hasColon = yield* optional(token(char(":")));

          let value: Expression;
          if (hasColon) {
            value = yield* Parser.lazy(() => expression).expect("property value");
          } else {
            // Shorthand property - key must be an identifier
            if (typeof key !== "string") {
              return yield* Parser.error("Shorthand properties must use identifiers");
            }
            value = { type: "identifier" as const, name: key };
          }

          return { key, value };
        }),
        token(char(","))
      );
      yield* token(char("}")).expect("closing brace for object");
      return { type: "object" as const, properties };
    })
  ),

  // Array literal
  atomic(
    Parser.gen(function* () {
      yield* token(char("["));
      yield* commit();
      const elements = yield* sepBy(
        Parser.lazy(() => expression),
        token(char(","))
      );
      yield* token(char("]")).expect("closing bracket for array");
      return { type: "array" as const, elements };
    })
  ),

  // Parenthesized expression
  between(
    token(char("(")),
    token(char(")")),
    Parser.lazy(() => expression)
  )
);

// Postfix expressions (function calls, member access)
const postfixExpression: Parser<Expression> = Parser.gen(function* () {
  let expr = yield* primaryExpression;

  while (true) {
    const next = yield* optional(
      or(
        // Function call
        atomic(
          Parser.gen(function* () {
            yield* token(char("("));
            const args = yield* sepBy(
              Parser.lazy(() => expression),
              token(char(","))
            );
            yield* token(char(")")).expect("closing parenthesis for function call");
            return { type: "call" as const, args };
          })
        ),
        // Member access
        atomic(
          Parser.gen(function* () {
            yield* token(char("."));
            const property = yield* identifier.expect("property name after '.'");
            return { type: "member" as const, property };
          })
        )
      )
    );

    if (!next) break;

    if (next.type === "call") {
      expr = { type: "call", callee: expr, args: next.args };
    } else {
      expr = { type: "member", object: expr, property: next.property };
    }
  }

  return expr;
});

// Unary expressions
const unaryExpression: Parser<Expression> = or(
  Parser.gen(function* () {
    const op = yield* unaryOp;
    const arg = yield* unaryExpression;
    return { type: "unary" as const, op, arg };
  }),
  postfixExpression
);

// Binary expressions (simplified - no precedence for now)
const binaryExpression: Parser<Expression> = Parser.gen(function* () {
  const left = yield* unaryExpression;
  const rest = yield* optional(
    Parser.gen(function* () {
      const op = yield* binaryOp;
      const right = yield* binaryExpression;
      return { op, right };
    })
  );

  if (rest) {
    return { type: "binary" as const, left, op: rest.op, right: rest.right };
  }
  return left;
});

// Assignment expression
expression = Parser.gen(function* () {
  const left = yield* binaryExpression;
  const assignment = yield* optional(
    Parser.gen(function* () {
      const op = yield* assignmentOp;
      yield* commit(); // After seeing assignment op, we're committed
      const right = yield* expression.expect("expression after assignment operator");
      return { op, right };
    })
  );

  if (assignment) {
    // Validate left-hand side
    if (left.type !== "identifier" && left.type !== "member") {
      return yield* Parser.fatal("Invalid assignment target");
    }
    return { type: "binary" as const, left, op: assignment.op, right: assignment.right };
  }

  return left;
});

// =============================================================================
// Statement Parsers
// =============================================================================

let statement: Parser<Statement>;

const blockStatement: Parser<Statement> = atomic(
  Parser.gen(function* () {
    yield* token(char("{"));
    // Don't commit immediately - this could be an object literal
    const body = yield* many(Parser.lazy(() => statement));
    yield* token(char("}")).expect("closing brace for block");
    return { type: "block" as const, body };
  })
);

const variableStatement: Parser<Statement> = Parser.gen(function* () {
  const kind = yield* or(keyword("let"), keyword("const")) as Parser<"let" | "const">;
  yield* commit();

  const name = yield* identifier.expect("variable name");

  const init = yield* optional(
    Parser.gen(function* () {
      yield* token(char("="));
      return yield* expression.expect("initializer expression");
    })
  );

  if (kind === "const" && !init) {
    return yield* Parser.fatal("Missing initializer in const declaration");
  }

  yield* token(char(";")).expect("semicolon after variable declaration");

  return { type: "variable" as const, kind, name, init };
});

const functionStatement: Parser<Statement> = Parser.gen(function* () {
  yield* keyword("function");
  yield* commit();

  const name = yield* identifier.expect("function name");
  yield* token(char("(")).expect("opening parenthesis");
  const params = yield* sepBy(identifier, token(char(",")));
  yield* token(char(")")).expect("closing parenthesis");
  const body = yield* blockStatement.expect("function body");

  return {
    type: "function" as const,
    name,
    params,
    body: (body as { type: "block"; body: Statement[] }).body
  };
});

const ifStatement: Parser<Statement> = parser(function* () {
  yield* keyword("if").commit();
  // yield* commit();

  yield* token(char("(")).expect("opening parenthesis after 'if'");
  const test = yield* expression.expect("condition expression");
  yield* token(char(")")).expect("closing parenthesis");

  const consequent = yield* statement.expect("if body");

  const alternate = yield* optional(
    parser(function* () {
      yield* keyword("else").commit();
      // yield* commit();
      return yield* statement.expect("else body");
    })
  );

  return { type: "if" as const, test, consequent, alternate };
});

const returnStatement: Parser<Statement> = Parser.gen(function* () {
  yield* keyword("return");
  yield* commit();

  // Check if there's an expression on the same line
  const value = yield* optional(
    // Look ahead to see if semicolon or newline comes next
    regex(/(?![;\n])/).then(expression)
  );

  yield* token(char(";")).expect("semicolon after return statement");

  return { type: "return" as const, value };
});

// Expression statement
const expressionStatement: Parser<Statement> = Parser.gen(function* () {
  const expr = yield* expression;
  yield* token(char(";")).expect("semicolon after expression");
  return { type: "expression" as const, expression: expr };
});

statement = or(
  blockStatement,
  variableStatement,
  functionStatement,
  ifStatement,
  returnStatement,
  expressionStatement
);

// Program parser
const program = Parser.gen(function* () {
  yield* spaces; // Skip leading whitespace
  const statements = yield* many(statement);
  yield* spaces; // Skip trailing whitespace
  yield* eof.expect("end of input");
  return statements;
});

// =============================================================================
// Test the parser
// =============================================================================

const formatter = new ErrorFormatter("html");

const testCases = [
  // Valid programs
  `let x = 42;`,
  `const name = "John";`,
  `function greet(name) { return "Hello, " + name; }`,
  `if (x > 0) { console.log(x); }`,
  `const obj = { name: "Alice", age: 30 };`,
  `const arr = [1, 2, 3];`,
  `result = fn(x, y) + z;`,

  // Object literal test cases
  `const obj = { name: "Alice", age };`, // Shorthand property
  `const obj2 = { x };`, // Single shorthand property
  `const mixed = { a: 1, b, c: 3, d };`, // Mixed regular and shorthand
  `const nested = { a: { b: 1 }, c };`, // Nested object with shorthand
  `const empty = {};`, // Empty object

  // Array literal test cases
  `const empty = [];`, // Empty array
  `const nested = [1, [2, 3], 4];`, // Nested array

  // Complex expressions
  `const result = { x: fn(a, b), y };`, // Function call in object
  `const val = obj.prop.method();`, // Chained member access
  `const sum = a + b * c - d;`, // Multiple operators (no precedence yet)

  // Error cases that demonstrate our error handling
  `let = 5;`, // Missing variable name
  `const x;`, // const without initializer (fatal error)
  `if x > 0 { }`, // Missing parentheses (commit error)
  `function { }`, // Missing function name (commit error)
  `let if = 10;`, // Reserved keyword as identifier
  `return 42`, // Missing semicolon
  `{ let x = 1; let y = 2; }`, // Block statement
  `const obj = { "str": value };` // String key with colon
];

console.log("=== Simple JavaScript Parser ===\n");

for (const code of testCases) {
  const result = program.parse(code);

  if (Either.isLeft(result.result)) {
    console.log(result.result.left.format("ansi"));
  }
}
