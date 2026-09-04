import {
  attempt,
  char,
  commit,
  eof,
  many,
  optional,
  choice,
  parser,
  regex,
  skipMany,
  literal
} from "../src/index.ts"
import type { Parser } from "../src/index.ts"

const whitespace = regex(/[ \t]+/).context("whitespace")
const lineBreak = choice(literal("\r\n"), literal("\n"), literal("\r")).context(
  "line break"
)
const blankLine = regex(/[ \t]*[\r\n]/).context("blank line")
const comment = regex(/[;#][^\n\r]*/).context("comment")
const space = choice(whitespace, comment)
const spaces = skipMany(space)
const spacesNewlines = skipMany(choice(space, lineBreak, blankLine))

function token<T>(parser: Parser<T>): Parser<T> {
  return spaces.zipRight(parser)
}

export type IniSection = {
  name: string
  properties: Array<{ key: string; value: string }>
}

export type IniFile = IniSection[]

const key = token(regex(/[a-zA-Z0-9_.-]+/).context("property key"))

const value = regex(/[^\r\n]*/)
  .map(s => s.trim())
  .context("property value")

const property = attempt(
  parser(function* () {
    const k = yield* key
    yield* token(char("="))
    yield* commit()
    const v = yield* value.expected("property value after '='")
    return { key: k, value: v }
  })
)

const section = attempt(
  parser(function* () {
    yield* spacesNewlines
    yield* token(char("["))
    yield* commit()
    const name = yield* regex(/[^\]]+/)
      .map(s => s.trim())
      .expected("section name")
    yield* char("]").expected("closing bracket ']'")
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
  yield* eof.expected("end of input")
  return sections
})
