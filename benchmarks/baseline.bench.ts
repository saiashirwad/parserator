import { readFileSync } from "fs";
import { join } from "path";
import { bench, run, group } from "./setup";
import { json as parseratorJson } from "../examples/json-parser";
import { createToken, Lexer, CstParser } from "chevrotain";

const json1kb = readFileSync(
  join(__dirname, "fixtures/json-1kb.json"),
  "utf-8"
);

const True = createToken({ name: "True", pattern: /true/ });
const False = createToken({ name: "False", pattern: /false/ });
const Null = createToken({ name: "Null", pattern: /null/ });
const LCurly = createToken({ name: "LCurly", pattern: /{/ });
const RCurly = createToken({ name: "RCurly", pattern: /}/ });
const LSquare = createToken({ name: "LSquare", pattern: /\[/ });
const RSquare = createToken({ name: "RSquare", pattern: /]/ });
const Comma = createToken({ name: "Comma", pattern: /,/ });
const Colon = createToken({ name: "Colon", pattern: /:/ });
const StringLiteral = createToken({
  name: "StringLiteral",
  pattern: /"(?:[^\\"]|\\(?:[bfnrtv"\\/]|u[0-9a-fA-F]{4}))*"/
});
const NumberLiteral = createToken({
  name: "NumberLiteral",
  pattern: /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/
});
const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED
});

const allTokens = [
  WhiteSpace,
  NumberLiteral,
  StringLiteral,
  LCurly,
  RCurly,
  LSquare,
  RSquare,
  Comma,
  Colon,
  True,
  False,
  Null
];

const JsonLexer = new Lexer(allTokens);

class JsonParser extends CstParser {
  constructor() {
    super(allTokens);
    this.performSelfAnalysis();
  }

  public json = this.RULE("json", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.object) },
      { ALT: () => this.SUBRULE(this.array) }
    ]);
  });

  private object = this.RULE("object", () => {
    this.CONSUME(LCurly);
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => {
        this.SUBRULE(this.objectItem);
      }
    });
    this.CONSUME(RCurly);
  });

  private objectItem = this.RULE("objectItem", () => {
    this.CONSUME(StringLiteral);
    this.CONSUME(Colon);
    this.SUBRULE(this.value);
  });

  private array = this.RULE("array", () => {
    this.CONSUME(LSquare);
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => {
        this.SUBRULE(this.value);
      }
    });
    this.CONSUME(RSquare);
  });

  private value = this.RULE("value", () => {
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.SUBRULE(this.object) },
      { ALT: () => this.SUBRULE(this.array) },
      { ALT: () => this.CONSUME(True) },
      { ALT: () => this.CONSUME(False) },
      { ALT: () => this.CONSUME(Null) }
    ]);
  });
}

const parser = new JsonParser();

group("Parser Comparison - 1KB JSON", () => {
  bench("parserator", () => {
    parseratorJson.parseOrThrow(json1kb);
  });

  bench("chevrotain", () => {
    const lexResult = JsonLexer.tokenize(json1kb);
    parser.input = lexResult.tokens;
    parser.json();
  });

  bench("native JSON.parse", () => {
    JSON.parse(json1kb);
  });
});

run();
