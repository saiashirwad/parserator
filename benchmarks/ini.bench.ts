import { readFileSync } from "fs";
import { join } from "path";
import { bench, run, group } from "./setup";
import {
  atomic,
  char,
  commit,
  eof,
  many,
  optional,
  or,
  Parser,
  regex,
  skipMany0,
  string,
  parser
} from "../src";

const whitespace = regex(/[ \t]+/);
const lineBreak = or(string("\r\n"), string("\n"), string("\r"));
const blankLine = regex(/[ \t]*[\r\n]/);
const comment = regex(/[;#][^\n\r]*/);
const space = or(whitespace, comment);
const spaces = skipMany0(space);
const spacesNewlines = skipMany0(or(space, lineBreak, blankLine));

function token<T>(p: Parser<T>): Parser<T> {
  return p.trimLeft(spaces);
}

type IniValue = {
  type: "section";
  name: string;
  properties: Array<{ key: string; value: string }>;
};

const key = token(regex(/[a-zA-Z0-9_\-\.]+/));
const value = regex(/[^\r\n]*/).map(s => s.trim());

const property = atomic(
  parser(function* () {
    const k = yield* key;
    yield* token(char("="));
    yield* commit();
    const v = yield* value;
    return { key: k, value: v };
  })
);

const section: Parser<IniValue> = atomic(
  parser(function* () {
    yield* spacesNewlines;
    yield* token(char("["));
    yield* commit();
    const name = yield* regex(/[^\]]+/).map(s => s.trim());
    yield* char("]");
    yield* optional(lineBreak);

    const properties = yield* many(
      parser(function* () {
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

const iniFile = parser(function* () {
  yield* spacesNewlines;
  const sections = yield* many(section);
  yield* spacesNewlines;
  yield* eof;
  return sections;
});

const iniConfig = readFileSync(
  join(__dirname, "fixtures/ini-config.ini"),
  "utf-8"
);

group("INI Parsing", () => {
  bench("parserator INI parser", () => {
    iniFile.parseOrThrow(iniConfig);
  });
});

run();
