import {
  atomic,
  char,
  commit,
  digit,
  Either,
  eof,
  ErrorFormatter,
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
} from "../src";
import { peekAhead } from "../src/utils";

export namespace LispExpr {
  export type LispExpr = Symbol | Number | String | Boolean | List | If | Lambda | Let;

  export type Symbol = { readonly type: "Symbol"; name: string };

  export type Number = { readonly type: "Number"; value: number };

  export type String = { readonly type: "String"; value: string };

  export type Boolean = { readonly type: "Boolean"; value: boolean };

  export type List = { readonly type: "List"; items: LispExpr[] };

  export type If = {
    readonly type: "If";
    condition: LispExpr;
    consequent: LispExpr;
    alternate: LispExpr;
  };

  export type Lambda = { readonly type: "Lambda"; params: string[]; body: LispExpr };

  export type Let = {
    readonly type: "Let";
    bindings: Array<{ name: string; value: LispExpr }>;
    body: LispExpr;
  };
}

export const LispExpr = {
  symbol: (name: string): LispExpr.LispExpr => ({ type: "Symbol", name }),

  number: (value: number): LispExpr.LispExpr => ({ type: "Number", value }),

  string: (value: string): LispExpr.LispExpr => ({ type: "String", value }),

  bool: (value: boolean): LispExpr.LispExpr => ({ type: "Boolean", value }),

  list: (items: LispExpr.LispExpr[]): LispExpr.LispExpr => ({ type: "List", items }),

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
};

// =============================================================================
// Lexical Elements
// =============================================================================

const whitespace = regex(/\s+/).label("whitespace");
const lineComment = regex(/;[^\n]*/).label("line comment");
const space = or(whitespace, lineComment);
const spaces = skipMany0(space);

function token<T>(parser: Parser<T>): Parser<T> {
  return parser.trimLeft(spaces);
}

// =============================================================================
// Expression Parsers
// =============================================================================

// Forward declaration for recursive parsers
export let expr: Parser<LispExpr.LispExpr>;

const symbol = token(
  parser(function* () {
    const name = yield* regex(/[^()\s;]+/).label("symbol name");
    if (name === "") {
      return yield* Parser.fatal("Empty symbol");
    }
    return LispExpr.symbol(name);
  })
);

const number = token(
  parser(function* () {
    const sign = (yield* optional(char("-"))) ?? "";
    const digits = yield* many1(digit).expect("Expected digit in number");
    const decimalPart = yield* optional(
      parser(function* () {
        yield* char(".");
        const fractionalDigits = yield* many1(digit).expect("Expected digits after decimal point");
        return "." + fractionalDigits.join("");
      })
    );

    const numberStr = sign + digits.join("") + (decimalPart ?? "");
    const value = parseFloat(numberStr);
    return LispExpr.number(value);
  })
);

const stringLiteral = token(
  parser(function* () {
    yield* char('"');
    yield* commit();

    const value = yield* takeUpto(char('"'));
    yield* char('"').expect("closing quote for string literal");
    return LispExpr.string(value);
  })
);

const boolean = token(
  or(
    string("#t").map(() => LispExpr.bool(true)),
    string("#f").map(() => LispExpr.bool(false))
  ).label("boolean")
);

const atom = or(boolean, number, stringLiteral, symbol);

// List parsing with better error handling
const list = atomic(
  parser(function* () {
    yield* token(char("("));
    yield* commit();

    const items = yield* many(Parser.lazy(() => expr));

    yield* token(char(")")).expect("closing parenthesis ')'");
    return items;
  })
);

// Special form parsers
const lambdaParser = (items: LispExpr.LispExpr[]) =>
  parser(function* () {
    if (items.length !== 3) {
      return yield* Parser.fatal("Lambda requires exactly 3 elements: (lambda (params...) body)");
    }

    const [lambdaSymbol, paramsExpr, bodyExpr] = items;

    if (lambdaSymbol.type !== "Symbol" || lambdaSymbol.name !== "lambda") {
      return yield* Parser.fatal("Expected 'lambda' keyword");
    }

    if (paramsExpr.type !== "List") {
      return yield* Parser.fatal("Lambda parameters must be a list");
    }

    const params: string[] = [];
    for (const param of paramsExpr.items) {
      if (param.type !== "Symbol") {
        return yield* Parser.fatal("Lambda parameters must be symbols");
      }
      params.push(param.name);
    }

    return LispExpr.lambda(params, bodyExpr);
  });

const letParser = (items: LispExpr.LispExpr[]) =>
  parser(function* () {
    if (items.length !== 3) {
      return yield* Parser.fatal("Let requires exactly 3 elements: (let ((var val)...) body)");
    }

    const [letSymbol, bindingsExpr, bodyExpr] = items;

    if (letSymbol.type !== "Symbol" || letSymbol.name !== "let") {
      return yield* Parser.fatal("Expected 'let' keyword");
    }

    if (bindingsExpr.type !== "List") {
      return yield* Parser.fatal("Let bindings must be a list");
    }

    const bindings: LispExpr.Let["bindings"] = [];
    for (const binding of bindingsExpr.items) {
      if (binding.type !== "List" || binding.items.length !== 2) {
        return yield* Parser.fatal("Each let binding must be a list of exactly 2 elements");
      }

      const [nameExpr, valueExpr] = binding.items;
      if (nameExpr.type !== "Symbol") {
        return yield* Parser.fatal("Let binding name must be a symbol");
      }

      bindings.push({ name: nameExpr.name, value: valueExpr });
    }

    return LispExpr.let(bindings, bodyExpr);
  });

const ifParser = (items: LispExpr.LispExpr[]) =>
  parser(function* () {
    if (items.length !== 4) {
      return yield* Parser.fatal(
        "If requires exactly 4 elements: (if condition consequent alternate)"
      );
    }

    const [ifSymbol, condition, consequent, alternate] = items;

    if (ifSymbol.type !== "Symbol" || ifSymbol.name !== "if") {
      return yield* Parser.fatal("Expected 'if' keyword");
    }

    return LispExpr.if(condition, consequent, alternate);
  });

// Enhanced list parser with special form detection
const listParser = list.flatMap(items =>
  parser(function* () {
    if (items.length === 0) {
      return yield* Parser.fatal("Empty list not allowed");
    }

    const first = items[0];
    if (first.type === "Symbol") {
      switch (first.name) {
        case "lambda":
          return yield* lambdaParser(items);
        case "let":
          return yield* letParser(items);
        case "if":
          return yield* ifParser(items);
      }
    }

    return LispExpr.list(items);
  })
);

// Main expression parser
expr = parser(function* () {
  yield* spaces;

  const isList = yield* peekAhead(1).map(x => x === "(");
  const result = yield* isList ? listParser : atom;

  yield* spaces;
  return result;
});

// Program parser (multiple expressions)
export const program = parser(function* () {
  yield* spaces;
  const expressions = yield* many(expr);
  yield* spaces;
  yield* eof.expect("end of input");

  if (expressions.length === 0) {
    return yield* Parser.fatal("Expected at least one expression");
  }

  return expressions;
});

// Single expression parser for REPL-style usage
export const lispParser = parser(function* () {
  yield* spaces;
  const result = yield* expr;
  yield* spaces;
  yield* eof.expect("end of input");
  return result;
});

const formatter = new ErrorFormatter("ansi");

const testCases = [
  // Basic atoms
  `42`,
  `-123`,
  `3.14`,
  `"hello world"`,
  `#t`,
  `#f`,
  `symbol`,
  `my-variable`,

  // Simple lists
  `(+ 1 2)`,
  `(* 3 4)`,
  `(cons 1 2)`,
  `(list 1 2 3)`,

  // Nested lists
  `(+ (* 2 3) 4)`,
  `(list (+ 1 2) (* 3 4))`,

  // Lambda expressions
  `(lambda (x) x)`,
  `(lambda (x y) (+ x y))`,
  `(lambda () 42)`,
  `(lambda (f x) (f x))`,

  // Let expressions
  `(let ((x 1)) x)`,
  `(let ((x 1) (y 2)) (+ x y))`,
  `(let ((square (lambda (x) (* x x)))) (square 5))`,

  // If expressions
  `(if #t 1 2)`,
  `(if #f "yes" "no")`,
  `(if (> x 0) x (- x))`,

  // Complex nested expressions
  `(let ((factorial (lambda (n)
                      (if (= n 0)
                          1
                          (* n (factorial (- n 1)))))))
     (factorial 5))`,

  // Comments
  `; This is a comment
   (+ 1 2)`,

  `(+ 1 ; inline comment
     2)`,

  // Multiple expressions (program)
  `(define x 10)
   (define y 20)
   (+ x y)`,

  // Error cases
  `()`, // Empty list
  `(lambda x)`, // Invalid lambda syntax
  `(let x 1)`, // Invalid let syntax
  `(if #t)`, // Incomplete if
  `"unterminated string`, // Unterminated string
  `(unclosed list` // Unclosed list
];

console.log("=== Scheme Parser Tests ===\n");

// Test single expressions
console.log("--- Single Expression Tests ---\n");
for (const code of testCases) {
  console.log(`Input: ${code.replace(/\n/g, "\\n")}`);
  const result = lispParser.parse(code);

  if (Either.isLeft(result.result)) {
    console.log("❌ Error:");
    console.log(formatter.format(result.result.left));
  } else {
    console.log("✅ Parsed successfully!");
    console.log("AST:", JSON.stringify(result.result.right, null, 2));
  }
  console.log("\n" + "=".repeat(50) + "\n");
}

// Test program parsing (multiple expressions)
console.log("--- Program Tests ---\n");
const programTests = [
  `(define pi 3.14159)
   (define area (lambda (r) (* pi (* r r))))
   (area 5)`,

  `; Calculate factorial
   (define factorial
     (lambda (n)
       (if (= n 0)
           1
           (* n (factorial (- n 1))))))

   ; Test it
   (factorial 6)`,

  `(let ((x 10)
         (y 20))
     (let ((sum (+ x y))
           (product (* x y)))
       (list sum product)))`
];

for (const code of programTests) {
  console.log(`Program: ${code.replace(/\n/g, "\\n")}`);
  const result = program.parse(code);

  if (Either.isLeft(result.result)) {
    console.log("❌ Error:");
    console.log(formatter.format(result.result.left));
  } else {
    console.log("✅ Parsed successfully!");
    console.log("Expressions:", JSON.stringify(result.result.right, null, 2));
  }
  console.log("\n" + "=".repeat(50) + "\n");
}

// Helper function to pretty-print AST
function prettyPrintAST(expr: LispExpr.LispExpr, indent = 0): string {
  const spaces = "  ".repeat(indent);

  switch (expr.type) {
    case "Symbol":
      return `${spaces}Symbol: ${expr.name}`;
    case "Number":
      return `${spaces}Number: ${expr.value}`;
    case "String":
      return `${spaces}String: "${expr.value}"`;
    case "Boolean":
      return `${spaces}Boolean: ${expr.value}`;
    case "List":
      const items = expr.items.map(item => prettyPrintAST(item, indent + 1)).join("\n");
      return `${spaces}List:\n${items}`;
    case "Lambda":
      const params = expr.params.join(", ");
      const body = prettyPrintAST(expr.body, indent + 1);
      return `${spaces}Lambda(${params}):\n${body}`;
    case "Let":
      const bindings = expr.bindings
        .map(b => `${spaces}  ${b.name} = ${prettyPrintAST(b.value, 0).trim()}`)
        .join("\n");
      const letBody = prettyPrintAST(expr.body, indent + 1);
      return `${spaces}Let:\n${bindings}\n${spaces}Body:\n${letBody}`;
    case "If":
      const condition = prettyPrintAST(expr.condition, indent + 1);
      const consequent = prettyPrintAST(expr.consequent, indent + 1);
      const alternate = prettyPrintAST(expr.alternate, indent + 1);
      return `${spaces}If:\n${spaces}  Condition:\n${condition}\n${spaces}  Then:\n${consequent}\n${spaces}  Else:\n${alternate}`;
    default:
      return `${spaces}Unknown: ${JSON.stringify(expr)}`;
  }
}

// Example of pretty printing
console.log("--- Pretty Print Example ---\n");
const exampleCode = `(let ((factorial (lambda (n)
                                    (if (= n 0)
                                        1
                                        (* n (factorial (- n 1)))))))
                       (factorial 5))`;

const parseResult = lispParser.parse(exampleCode);
if (Either.isRight(parseResult.result)) {
  console.log("Pretty printed AST:");
  console.log(prettyPrintAST(parseResult.result.right));
}
