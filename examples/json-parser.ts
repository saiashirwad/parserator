import {
  between,
  char,
  choice,
  eof,
  literal,
  parser,
  recursive,
  regex,
  sepBy,
  takeWhileChar1
} from "../src/index.ts"
import type { Parser } from "../src/index.ts"

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

const whitespace = regex(/[ \t\r\n]*/)

const token = <T>(inner: Parser<T>): Parser<T> =>
  whitespace.zipRight(inner).zipLeft(whitespace)

const punctuation = <const T extends string>(value: T): Parser<T> =>
  token(char(value))

const jsonNull = literal("null").map(() => null)

const jsonBool = choice(
  literal("true").map(() => true),
  literal("false").map(() => false)
)

const jsonNumber = regex(/-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/).map(
  Number
)

const escapes: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t"
}

const escape = char("\\").zipRight(
  choice(
    regex(/u[0-9a-fA-F]{4}/).map(hex =>
      String.fromCharCode(parseInt(hex.slice(1), 16))
    ),
    regex(/["\\/bfnrt]/).map(c => escapes[c]!)
  )
)

const stringPart = choice(
  escape,
  takeWhileChar1(
    char => char !== '"' && char !== "\\" && (char.codePointAt(0) ?? 0) > 0x1f,
    "JSON string character"
  ),
  char('"').map(() => null)
)

const jsonString = parser(function* () {
  yield* char('"')
  const chars: string[] = []

  while (true) {
    const next = yield* stringPart
    if (next === null) break
    chars.push(next)
  }

  return chars.join("")
})

const jsonValue: Parser<JsonValue> = token(
  recursive(() =>
    choice(jsonNull, jsonBool, jsonNumber, jsonString, jsonArray, jsonObject)
  )
)

const jsonArray: Parser<JsonValue[]> = between(
  punctuation("["),
  punctuation("]"),
  sepBy(jsonValue, punctuation(","))
)

const jsonMember = token(jsonString).zipLeft(punctuation(":")).zip(jsonValue)

const jsonObject: Parser<{ [key: string]: JsonValue }> = between(
  punctuation("{"),
  punctuation("}"),
  sepBy(jsonMember, punctuation(","))
).map(pairs => Object.fromEntries(pairs))

export const json = jsonValue.zipLeft(eof)
