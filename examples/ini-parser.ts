import {
  atomic,
  char,
  commit,
  eof,
  many,
  optional,
  or,
  Parser,
  parser,
  regex,
  skipMany0,
  string
} from "../src/index.ts"

const whitespace = regex(/[ \t]+/).label("whitespace")
const lineBreak = or(string("\r\n"), string("\n"), string("\r")).label(
  "line break"
)
const blankLine = regex(/[ \t]*[\r\n]/).label("blank line")
const comment = regex(/[;#][^\n\r]*/).label("comment")
const space = or(whitespace, comment)
const spaces = skipMany0(space)
const spacesNewlines = skipMany0(or(space, lineBreak, blankLine))

function token<T>(parser: Parser<T>): Parser<T> {
  return parser.trimLeft(spaces)
}

export type IniSection = {
  name: string
  properties: Array<{ key: string; value: string }>
}

export type IniFile = IniSection[]

const key = token(regex(/[a-zA-Z0-9_.-]+/).label("property key"))

const value = regex(/[^\r\n]*/)
  .map(s => s.trim())
  .label("property value")

const property = atomic(
  parser(function* () {
    const k = yield* key
    yield* token(char("="))
    yield* commit()
    const v = yield* value.expect("property value after '='")
    return { key: k, value: v }
  })
)

const section: Parser<IniSection> = atomic(
  parser(function* () {
    yield* spacesNewlines
    yield* token(char("["))
    yield* commit()
    const name = yield* regex(/[^\]]+/)
      .map(s => s.trim())
      .expect("section name")
    yield* char("]").expect("closing bracket ']'")
    yield* optional(lineBreak)

    const properties = yield* many(
      parser(function* () {
        yield* spaces
        const prop = yield* property
        yield* optional(lineBreak)
        yield* spacesNewlines
        return prop
      })
    )

    return { name, properties }
  })
)

export const iniFile: Parser<IniFile> = parser(function* () {
  yield* spacesNewlines
  const sections = yield* many(section)
  yield* spacesNewlines
  yield* eof.expect("end of input")
  return sections
})
