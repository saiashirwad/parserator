import {
  attempt,
  char,
  choice,
  commit,
  eof,
  literal,
  many,
  optional,
  parser,
  regex,
  skipMany
} from "../src/index.ts"
import type { Parser } from "../src/index.ts"

export type IniSection = {
  name: string
  properties: Array<{ key: string; value: string }>
}

export type IniFile = IniSection[]

const whitespace = regex(/[ \t]+/).context("whitespace")

const lineBreak = choice(literal("\r\n"), literal("\n"), literal("\r")).context(
  "line break"
)

const comment = regex(/[;#][^\n\r]*/).context("comment")

const space = choice(whitespace, comment)

const spaces = skipMany(space)

const trivia = skipMany(choice(space, lineBreak))

function token<T>(inner: Parser<T>): Parser<T> {
  return spaces.zipRight(inner)
}

const propertyKey = token(regex(/[a-zA-Z0-9_.-]+/).context("property key"))

const propertyValue = regex(/[^\r\n]*/)
  .map(value => value.trim())
  .context("property value")

const property = attempt(
  parser(function* () {
    const key = yield* propertyKey
    yield* token(char("="))
    yield* commit()
    const value = yield* propertyValue.expected("property value after '='")
    return { key, value }
  })
)

const section = attempt(
  parser(function* () {
    yield* trivia
    yield* token(char("["))
    yield* commit()
    const name = yield* regex(/[^\]]+/)
      .map(name => name.trim())
      .expected("section name")
    yield* char("]").expected("closing bracket ']'")
    yield* optional(lineBreak)

    const properties = yield* many(
      property.zipLeft(optional(lineBreak)).zipLeft(trivia)
    )

    return { name, properties }
  })
)

export const iniFile: Parser<IniFile> = parser(function* () {
  yield* trivia
  const sections = yield* many(section)
  yield* trivia
  yield* eof.expected("end of input")
  return sections
})
