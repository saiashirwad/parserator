import {
  atomic,
  between,
  char,
  commit,
  Either,
  eof,
  ErrorFormatter,
  many,
  many1,
  notFollowedBy,
  optional,
  or,
  parser,
  Parser,
  regex,
  sepBy,
  sepBy1,
  skipMany0,
  string
} from "../../src";

import { Literal, Pattern, Type, Expr, TypeDef, Declaration } from "./ast";
import type {
  MatchCase,
  LetBinding,
  ConstructorDef,
  Program,
  TypeParam
} from "./ast";

const whitespace = regex(/[ \t\n\r]+/);
const ocamlComment = regex(/\(\*[^*]*\*+(?:[^(*][^*]*\*+)*\)/);
const haskellComment = regex(/--[^\n]*/);
const space = or(whitespace, ocamlComment, haskellComment);
const spaces = skipMany0(space);

function token<T>(p: Parser<T>): Parser<T> {
  return p.trimLeft(spaces);
}

const keywords = new Set([
  "let",
  "rec",
  "in",
  "if",
  "then",
  "else",
  "match",
  "with",
  "fun",
  "function",
  "type",
  "of",
  "and",
  "true",
  "false",
  "when",
  "as",
  "mutable",
  "exception",
  "begin",
  "end"
]);

const reservedOps = new Set([
  "->",
  "<-",
  "=>",
  "|",
  ":",
  "::",
  "=",
  ";;",
  "_",
  ".",
  "..",
  "'"
]);

function keyword(kw: string): Parser<string> {
  return token(
    string(kw).thenDiscard(notFollowedBy(regex(/[a-zA-Z0-9_']/)))
  ).commit();
}

const lowercaseIdent = token(
  regex(/[a-z_][a-zA-Z0-9_']*/).flatMap(name =>
    keywords.has(name) ?
      Parser.fatal(`'${name}' is a reserved keyword`)
    : Parser.lift(name)
  )
);

const uppercaseIdent = token(regex(/[A-Z][a-zA-Z0-9_']*/));

const typeVar = token(regex(/'[a-z][a-zA-Z0-9_']*/));

const operator = token(
  regex(/[!$%&*+\-./:<=>?@^|~]+/).flatMap(op =>
    reservedOps.has(op) ?
      Parser.fatal(`'${op}' is a reserved operator`)
    : Parser.lift(op)
  )
);

const intLiteral: Parser<Literal> = token(
  regex(/-?(?:0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|[0-9]+)/)
    .map(s => {
      if (s.startsWith("0x") || s.startsWith("0X")) return parseInt(s, 16);
      if (s.startsWith("0o") || s.startsWith("0O"))
        return parseInt(s.slice(2), 8);
      if (s.startsWith("0b") || s.startsWith("0B"))
        return parseInt(s.slice(2), 2);
      return parseInt(s, 10);
    })
    .map(Literal.int)
);

const floatLiteral: Parser<Literal> = token(
  regex(/-?[0-9]+\.[0-9]*(?:[eE][+-]?[0-9]+)?|-?[0-9]+[eE][+-]?[0-9]+/)
    .map(parseFloat)
    .map(Literal.float)
);

const charLiteral: Parser<Literal> = token(
  parser(function* () {
    yield* char("'");
    const c = yield* or(
      string("\\'").map(() => "'"),
      string("\\n").map(() => "\n"),
      string("\\t").map(() => "\t"),
      string("\\r").map(() => "\r"),
      string("\\\\").map(() => "\\"),
      regex(/[^'\\]/)
    );
    yield* char("'").expect("closing quote for char literal");
    return Literal.char(c);
  })
);

const stringLiteral: Parser<Literal> = token(
  parser(function* () {
    yield* char('"');
    yield* commit();
    const chars: string[] = [];
    while (true) {
      const escaped = yield* optional(
        or(
          string('\\"').map(() => '"'),
          string("\\n").map(() => "\n"),
          string("\\t").map(() => "\t"),
          string("\\r").map(() => "\r"),
          string("\\\\").map(() => "\\")
        )
      );
      if (escaped !== undefined) {
        chars.push(escaped);
        continue;
      }
      const regular = yield* optional(regex(/[^"\\]+/));
      if (regular) {
        chars.push(regular);
        continue;
      }
      break;
    }
    yield* char('"').expect("closing quote for string literal");
    return Literal.string(chars.join(""));
  })
);

const boolLiteral: Parser<Literal> = or(
  keyword("true").map(() => Literal.bool(true)),
  keyword("false").map(() => Literal.bool(false))
);

const unitLiteral: Parser<Literal> = token(string("()")).map(() =>
  Literal.unit()
);

const literal: Parser<Literal> = or(
  floatLiteral,
  intLiteral,
  charLiteral,
  stringLiteral,
  boolLiteral,
  unitLiteral
);

const pattern: Parser<Pattern> = Parser.lazy(() => annotatedPattern);

const wildcardPattern: Parser<Pattern> = token(char("_")).map(() =>
  Pattern.wildcard()
);

const varPattern: Parser<Pattern> = lowercaseIdent.map(Pattern.var);

const litPattern: Parser<Pattern> = literal.map(Pattern.lit);

const constructorPattern: Parser<Pattern> = parser(function* () {
  const name = yield* uppercaseIdent;
  const args = yield* many(simplePattern);
  return Pattern.constructor(name, args);
});

const tupleOrParenPattern: Parser<Pattern> = parser(function* () {
  yield* token(char("("));
  const first = yield* optional(pattern);
  if (first === undefined) {
    yield* token(char(")")).expect("closing paren");
    return Pattern.lit(Literal.unit());
  }
  const rest = yield* many(token(char(",")).then(pattern));
  yield* token(char(")")).expect("closing paren for pattern");
  if (rest.length === 0) return first;
  return Pattern.tuple([first, ...rest]);
});

const listPattern: Parser<Pattern> = parser(function* () {
  yield* token(char("["));
  yield* commit();
  const elements = yield* sepBy(pattern, token(char(",")));
  yield* token(char("]")).expect("closing bracket for list pattern");
  return Pattern.list(elements);
});

const simplePattern: Parser<Pattern> = Parser.lazy(() =>
  or(
    wildcardPattern,
    litPattern,
    tupleOrParenPattern,
    listPattern,
    constructorPattern,
    varPattern
  )
);

const consPattern: Parser<Pattern> = parser(function* () {
  let head = yield* simplePattern;
  while (true) {
    const hasCons = yield* optional(token(string("::")));
    if (!hasCons) break;
    const tail = yield* simplePattern.expect("pattern after ::");
    head = Pattern.cons(head, tail);
  }
  return head;
});

const asPattern: Parser<Pattern> = parser(function* () {
  const pat = yield* consPattern;
  const alias = yield* optional(keyword("as").then(lowercaseIdent));
  if (alias) return Pattern.as(pat, alias);
  return pat;
});

const orPattern: Parser<Pattern> = parser(function* () {
  const first = yield* asPattern;
  const rest = yield* many(token(char("|")).then(asPattern));
  if (rest.length === 0) return first;
  return rest.reduce((acc, p) => Pattern.or(acc, p), first);
});

const annotatedPattern: Parser<Pattern> = parser(function* () {
  const pat = yield* orPattern;
  const annotation = yield* optional(
    parser(function* () {
      yield* token(char(":"));
      return yield* typeExpr;
    })
  );
  if (annotation) return Pattern.annotated(pat, annotation);
  return pat;
});

const typeExpr: Parser<Type> = Parser.lazy(() => arrowType);

const typeConst: Parser<Type> = lowercaseIdent.map(Type.const);

const typeVarP: Parser<Type> = typeVar.map(name => Type.var(name.slice(1)));

const typeParens: Parser<Type> = parser(function* () {
  yield* token(char("("));
  const first = yield* typeExpr;
  const rest = yield* many(token(char("*")).then(typeExpr));
  yield* token(char(")")).expect("closing paren for type");
  if (rest.length === 0) return first;
  return Type.tuple([first, ...rest]);
});

const simpleType: Parser<Type> = or(typeParens, typeVarP, typeConst);

const typeApplication: Parser<Type> = parser(function* () {
  let base = yield* simpleType;
  while (true) {
    const constructor = yield* optional(lowercaseIdent);
    if (!constructor) break;
    base = Type.app(Type.const(constructor), [base]);
  }
  return base;
});

const tupleType: Parser<Type> = parser(function* () {
  const first = yield* typeApplication;
  const rest = yield* many(token(char("*")).then(typeApplication));
  if (rest.length === 0) return first;
  return Type.tuple([first, ...rest]);
});

const arrowType: Parser<Type> = parser(function* () {
  const first = yield* tupleType;
  const rest = yield* many(token(string("->")).then(tupleType));
  if (rest.length === 0) return first;
  return [...[first], ...rest.slice(0, -1)].reduceRight(
    (acc, t) => Type.arrow(t, acc),
    rest[rest.length - 1]
  );
});

const expr: Parser<Expr> = Parser.lazy(() => sequenceExpr);
const nonSequenceExpr: Parser<Expr> = Parser.lazy(() => simpleAnnotatedExpr);

const litExpr: Parser<Expr> = literal.map(Expr.lit);

const varExpr: Parser<Expr> = lowercaseIdent.map(Expr.var);

const constructorExpr: Parser<Expr> = uppercaseIdent.map(Expr.constructor);

const tupleOrParenExpr: Parser<Expr> = parser(function* () {
  yield* token(char("("));
  const first = yield* optional(expr);
  if (first === undefined) {
    yield* token(char(")")).expect("closing paren");
    return Expr.unit();
  }

  const hasOp = yield* optional(operator);
  if (hasOp && first.tag === "EVar") {
    yield* token(char(")")).expect("closing paren for operator section");
    return Expr.var(hasOp);
  }

  const rest = yield* many(token(char(",")).then(expr));
  yield* token(char(")")).expect("closing paren");
  if (rest.length === 0) return first;
  return Expr.tuple([first, ...rest]);
});

const listExpr: Parser<Expr> = parser(function* () {
  yield* token(char("["));
  yield* commit();
  const elements = yield* sepBy(nonSequenceExpr, token(char(";")));
  yield* optional(token(char(";")));
  yield* token(char("]")).expect("closing bracket for list");
  return Expr.list(elements);
});

const recordExpr: Parser<Expr> = atomic(
  parser(function* () {
    yield* token(char("{"));
    yield* commit();
    const fields = yield* sepBy1(
      parser(function* () {
        const label = yield* lowercaseIdent;
        yield* token(char("=")).expect("'=' in record field");
        const value = yield* nonSequenceExpr.expect("value for record field");
        return { label, value };
      }),
      token(char(";"))
    );
    yield* optional(token(char(";")));
    yield* token(char("}")).expect("closing brace for record");
    return Expr.record(fields);
  })
);

const beginEndExpr: Parser<Expr> = parser(function* () {
  yield* keyword("begin");
  yield* commit();
  const body = yield* expr;
  yield* keyword("end").expect("'end' to close 'begin'");
  return body;
});

const ifExpr: Parser<Expr> = parser(function* () {
  yield* keyword("if");
  yield* commit();
  const cond = yield* expr.expect("condition after 'if'");
  yield* keyword("then").expect("'then' after condition");
  const thenBranch = yield* expr.expect("expression after 'then'");
  yield* keyword("else").expect("'else' after 'then' branch");
  const elseBranch = yield* expr.expect("expression after 'else'");
  return Expr.if(cond, thenBranch, elseBranch);
});

const matchCaseBody: Parser<Expr> = parser(function* () {
  const peeked = yield* optional(token(char("|")));
  if (peeked !== undefined) {
    return yield* Parser.fatal(
      "empty match case body (found '|' instead of expression)"
    );
  }
  return yield* expr;
});

const matchCase: Parser<MatchCase> = parser(function* () {
  yield* optional(token(char("|")));
  const pat = yield* pattern;
  const guard = yield* optional(keyword("when").then(expr));
  yield* token(string("->")).expect("'->' in match case");
  const body = yield* matchCaseBody.expect("expression in match case");
  return { pattern: pat, guard, body };
});

const matchExpr: Parser<Expr> = parser(function* () {
  yield* keyword("match");
  yield* commit();
  const scrutinee = yield* expr.expect("expression after 'match'");
  yield* keyword("with").expect("'with' after match expression");
  const cases = yield* many1(matchCase).expect("at least one match case");
  return Expr.match(scrutinee, cases);
});

const funExpr: Parser<Expr> = parser(function* () {
  yield* keyword("fun");
  yield* commit();
  const params = yield* many1(simplePattern).expect("parameters after 'fun'");
  yield* token(string("->")).expect("'->' after fun parameters");
  const body = yield* expr.expect("body of fun expression");
  return Expr.fun(params, body);
});

const functionExpr: Parser<Expr> = parser(function* () {
  yield* keyword("function");
  yield* commit();
  const cases = yield* many1(matchCase).expect("at least one function case");
  const param = Pattern.var("$arg");
  return Expr.fun([param], Expr.match(Expr.var("$arg"), cases));
});

const letBinding: Parser<LetBinding> = parser(function* () {
  const pat = yield* simplePattern.expect("pattern or function name");
  const params = yield* many(simplePattern);
  const annotation = yield* optional(token(char(":")).then(typeExpr));
  yield* token(char("=")).expect("'=' in let binding");
  const value = yield* expr.expect("expression in let binding");
  return { pattern: pat, params, annotation, value };
});

const letExpr: Parser<Expr> = parser(function* () {
  yield* keyword("let");
  yield* commit();
  const isRec = (yield* optional(keyword("rec"))) !== undefined;
  const firstBinding = yield* letBinding;
  const moreBindings = yield* many(keyword("and").then(letBinding));
  const bindings = [firstBinding, ...moreBindings];
  yield* keyword("in").expect("'in' after let bindings");
  const body = yield* expr.expect("body after 'in'");
  if (isRec) return Expr.letRec(bindings, body);
  if (bindings.length === 1) return Expr.let(bindings[0], body);
  return bindings.reduceRight((acc, binding) => Expr.let(binding, acc), body);
});

const primaryExpr: Parser<Expr> = or(
  litExpr,
  ifExpr,
  matchExpr,
  funExpr,
  functionExpr,
  letExpr,
  beginEndExpr,
  recordExpr,
  listExpr,
  tupleOrParenExpr,
  constructorExpr,
  varExpr
);

const applicationExpr: Parser<Expr> = parser(function* () {
  let func = yield* primaryExpr;
  while (true) {
    const recordAccess = yield* optional(token(char(".")).then(lowercaseIdent));
    if (recordAccess) {
      func = Expr.recordAccess(func, recordAccess);
      continue;
    }
    const arg = yield* optional(primaryExpr);
    if (arg === undefined) break;
    func = Expr.app(func, arg);
  }
  return func;
});

const prefixExpr: Parser<Expr> = or(
  parser(function* () {
    const op = yield* or(
      token(char("-")).thenDiscard(notFollowedBy(regex(/[0-9]/))),
      token(string("not"))
    );
    const arg = yield* applicationExpr;
    return Expr.prefix(op, arg);
  }),
  applicationExpr
);

const infixOps: Array<{ ops: string[]; assoc: "left" | "right" }> = [
  { ops: ["*", "/", "mod"], assoc: "left" },
  { ops: ["+", "-"], assoc: "left" },
  { ops: ["::"], assoc: "right" },
  { ops: ["@", "^"], assoc: "right" },
  { ops: ["=", "<>", "<", ">", "<=", ">=", "==", "!="], assoc: "left" },
  { ops: ["&&", "&"], assoc: "right" },
  { ops: ["||", "or"], assoc: "right" }
];

function makeInfixParser(
  ops: string[],
  assoc: "left" | "right",
  lower: Parser<Expr>
): Parser<Expr> {
  const opParser = token(
    or(
      ...ops.map(op =>
        string(op).thenDiscard(notFollowedBy(regex(/[!$%&*+\-./:<=>?@^|~]/)))
      )
    )
  );

  if (assoc === "left") {
    return parser(function* () {
      let left = yield* lower;
      while (true) {
        const op = yield* optional(opParser);
        if (op === undefined) break;
        const right = yield* lower.expect(`expression after '${op}'`);
        left = Expr.infix(left, op, right);
      }
      return left;
    });
  } else {
    return parser(function* () {
      const left = yield* lower;
      const op = yield* optional(opParser);
      if (op === undefined) return left;
      const right: Expr = yield* makeInfixParser(ops, assoc, lower).expect(
        `expression after '${op}'`
      );
      return Expr.infix(left, op, right);
    });
  }
}

let infixExpr = prefixExpr;
for (const level of infixOps) {
  infixExpr = makeInfixParser(level.ops, level.assoc, infixExpr);
}

const simpleAnnotatedExpr: Parser<Expr> = parser(function* () {
  const e = yield* infixExpr;
  const annotation = yield* optional(
    parser(function* () {
      yield* token(char(":"));
      return yield* typeExpr;
    })
  );
  if (annotation) return Expr.annotated(e, annotation);
  return e;
});

const sequenceExpr: Parser<Expr> = parser(function* () {
  const first = yield* simpleAnnotatedExpr;
  const rest = yield* many(token(char(";")).then(simpleAnnotatedExpr));
  if (rest.length === 0) return first;
  return rest.reduce((acc, e) => Expr.sequence(acc, e), first);
});

const typeParams: Parser<TypeParam[]> = or(
  parser(function* () {
    yield* token(char("("));
    const params = yield* sepBy1(
      typeVar.map(s => s.slice(1)),
      token(char(","))
    );
    yield* token(char(")"));
    return params;
  }),
  typeVar.map(s => [s.slice(1)]),
  Parser.pure([])
);

const constructorDef: Parser<ConstructorDef> = parser(function* () {
  const name = yield* uppercaseIdent;
  const hasOf = yield* optional(keyword("of"));
  if (!hasOf) return { name, args: [] };
  const first = yield* typeApplication;
  const rest = yield* many(token(char("*")).then(typeApplication));
  return { name, args: [first, ...rest] };
});

const variantTypeDef: Parser<TypeDef> = parser(function* () {
  const params = yield* typeParams;
  const name = yield* lowercaseIdent;
  yield* token(char("=")).expect("'=' in type definition");
  yield* optional(token(char("|")));
  const constructors = yield* sepBy1(constructorDef, token(char("|"))).expect(
    "type constructor (e.g., 'None' or 'Some of int')"
  );
  return TypeDef.variant(params, name, constructors);
});

const aliasTypeDef: Parser<TypeDef> = parser(function* () {
  const params = yield* typeParams;
  const name = yield* lowercaseIdent;
  yield* token(char("=")).expect("'=' in type alias");
  const target = yield* typeExpr.expect("type expression");
  return TypeDef.alias(params, name, target);
});

const recordField: Parser<{ label: string; type: Type; mutable: boolean }> =
  parser(function* () {
    const isMutable = (yield* optional(keyword("mutable"))) !== undefined;
    const label = yield* lowercaseIdent;
    yield* token(char(":")).expect("':' in record field");
    const fieldType = yield* typeExpr.expect("type for record field");
    return { label, type: fieldType, mutable: isMutable };
  });

const recordTypeDef: Parser<TypeDef> = parser(function* () {
  const params = yield* typeParams;
  const name = yield* lowercaseIdent;
  yield* token(char("=")).expect("'=' in record type definition");
  yield* token(char("{"));
  yield* commit();
  const fields = yield* sepBy1(recordField, token(char(";")));
  yield* optional(token(char(";")));
  yield* token(char("}")).expect("'}' in record type definition");
  return TypeDef.record(params, name, fields);
});

const typeDef: Parser<TypeDef> = or(
  recordTypeDef,
  variantTypeDef,
  aliasTypeDef
);

const typeDecl: Parser<Declaration> = parser(function* () {
  yield* keyword("type");
  yield* commit();
  const first = yield* typeDef.expect("type definition after 'type'");
  const rest = yield* many(keyword("and").then(typeDef));
  return Declaration.type([first, ...rest]);
});

const letDecl: Parser<Declaration> = parser(function* () {
  yield* keyword("let");
  yield* commit();
  const isRec = (yield* optional(keyword("rec"))) !== undefined;
  const first = yield* letBinding.expect("let binding after 'let'");
  const rest = yield* many(keyword("and").then(letBinding));
  return Declaration.let(isRec, [first, ...rest]);
});

const exceptionDecl: Parser<Declaration> = parser(function* () {
  yield* keyword("exception");
  yield* commit();
  const name = yield* uppercaseIdent.expect("exception name");
  const hasOf = yield* optional(keyword("of"));
  if (!hasOf) return Declaration.exception(name, []);
  const first = yield* typeApplication;
  const rest = yield* many(token(char("*")).then(typeApplication));
  return Declaration.exception(name, [first, ...rest]);
});

const declaration: Parser<Declaration> = or(typeDecl, letDecl, exceptionDecl);

const programParser: Parser<Program> = parser(function* () {
  yield* spaces;
  const decls: Declaration[] = [];
  while (true) {
    const decl = yield* optional(declaration);
    if (decl === undefined) break;
    decls.push(decl);
    yield* optional(token(string(";;")));
  }
  yield* spaces;
  yield* eof.expect("end of input");
  return decls;
});

export { expr, pattern, typeExpr, declaration, programParser, nonSequenceExpr };
