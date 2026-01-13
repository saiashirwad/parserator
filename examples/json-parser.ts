import {
  parser,
  char,
  string,
  regex,
  or,
  many,
  sepBy,
  between,
  optional,
  Parser,
  skipSpaces
} from "../src";

const whitespace = regex(/\s*/);
function token<T>(p: Parser<T>): Parser<T> {
  return p.trimLeft(whitespace);
}

const jsonNull = string("null").map(() => null);
const jsonTrue = string("true").map(() => true);
const jsonFalse = string("false").map(() => false);
const jsonBool = or(jsonTrue, jsonFalse);

const jsonNumber = regex(/-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/).map(
  Number
);

const jsonString = parser(function* () {
  yield* char('"');
  const chars: string[] = [];

  while (true) {
    const next = yield* or(
      string('\\"').map(() => '"'),
      string("\\\\").map(() => "\\"),
      string("\\/").map(() => "/"),
      string("\\b").map(() => "\b"),
      string("\\f").map(() => "\f"),
      string("\\n").map(() => "\n"),
      string("\\r").map(() => "\r"),
      string("\\t").map(() => "\t"),
      regex(/\\u[0-9a-fA-F]{4}/).map(s =>
        String.fromCharCode(parseInt(s.slice(2), 16))
      ),
      regex(/[^"\\]+/),
      char('"').map(() => null)
    );

    if (next === null) break;
    chars.push(next);
  }

  return chars.join("");
});

const jsonValue: Parser<any> = Parser.lazy(() =>
  or(jsonNull, jsonBool, jsonNumber, jsonString, jsonArray, jsonObject)
);

const jsonArray: Parser<any[]> = between(
  token(char("[")),
  token(char("]")),
  sepBy(token(jsonValue), token(char(",")))
);

const jsonObject: Parser<Record<string, any>> = parser(function* () {
  yield* token(char("{"));

  const pairs = yield* sepBy(
    parser(function* () {
      const key = yield* token(jsonString);
      yield* token(char(":"));
      const value = yield* token(jsonValue);
      return [key, value] as const;
    }),
    token(char(","))
  );

  yield* token(char("}"));

  return Object.fromEntries(pairs);
});

export const json = token(jsonValue);

if (import.meta.main) {
  const testInput = `{
    "name": "parserator",
    "version": "0.1.41",
    "numbers": [1, 2, 3, 4.5, -6.7e-8],
    "nested": {
      "bool": true,
      "null": null,
      "string": "hello \\"world\\""
    }
  }`;

  try {
    const result = json.parseOrThrow(testInput);
    console.log("Parsed:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Parse error:", error);
  }
}
