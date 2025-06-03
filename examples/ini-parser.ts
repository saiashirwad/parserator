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
  Parser,
  regex,
  skipMany0,
  string
} from "../src";

const whitespace = regex(/[ \t]+/).label("whitespace");
const lineBreak = or(string("\r\n"), string("\n"), string("\r")).label("line break");
const blankLine = regex(/[ \t]*[\r\n]/).label("blank line");
const comment = regex(/[;#][^\n\r]*/).label("comment");
const space = or(whitespace, comment);
const spaces = skipMany0(space);
const spacesNewlines = skipMany0(or(space, lineBreak, blankLine));

function token<T>(parser: Parser<T>): Parser<T> {
  return parser.trimLeft(spaces);
}

type IniValue = {
  type: "section";
  name: string;
  properties: Array<{ key: string; value: string }>;
};

type IniFile = IniValue[];

const sectionName = between(
  char("["),
  char("]"),
  regex(/[^\]]+/).map(s => s.trim())
).label("section name");

const key = token(regex(/[a-zA-Z0-9_\-\.]+/).label("property key"));

const value = regex(/[^\r\n]*/)
  .map(s => s.trim())
  .label("property value");

const property = atomic(
  Parser.gen(function* () {
    const k = yield* key;
    yield* token(char("="));
    yield* commit();
    const v = yield* value.expect("property value after '='");
    return { key: k, value: v };
  })
);

const section: Parser<IniValue> = atomic(
  Parser.gen(function* () {
    yield* spacesNewlines;
    yield* token(char("["));
    yield* commit();
    const name = yield* regex(/[^\]]+/)
      .map(s => s.trim())
      .expect("section name");
    yield* char("]").expect("closing bracket ']'");
    yield* optional(lineBreak);

    const properties = yield* many(
      Parser.gen(function* () {
        yield* spaces;
        const prop = yield* property;
        yield* optional(lineBreak);
        yield* spacesNewlines;
        return prop;
      })
    );

    return {
      type: "section" as const,
      name,
      properties
    };
  })
);

const iniFile: Parser<IniFile> = Parser.gen(function* () {
  yield* spacesNewlines;
  const sections = yield* many(section);
  yield* spacesNewlines;
  yield* eof.expect("end of input");
  return sections;
});

const formatter = new ErrorFormatter("ansi");

const testCase = `
[database]
host = localhost
port = 5432
user = admin
; This is a comment
password = secret123

[cache]
enabled = true
ttl = 3600
# Another comment style

`;

const result = iniFile.parse(testCase);

if (Either.isLeft(result.result)) {
  console.log(formatter.format(result.result.left));
} else {
  console.log("Sections:", JSON.stringify(result.result.right, null, 2));
}
