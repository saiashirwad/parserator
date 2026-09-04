import {
  between,
  char,
  choice,
  parser,
  regex,
  recursive,
  sepBy,
  literal,
  eof,
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

// JSON permits only space, tab, carriage return, and line feed as whitespace.
const whitespace = regex(/[ \t\r\n]*/)
const token = <T>(p: Parser<T>): Parser<T> =>
  whitespace.zipRight(p).zipLeft(whitespace)

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

// Hoisted out of the generator: constructing parsers inside a parse loop
// would recompile the regex and reallocate the `choice` on every iteration.
const stringPart = choice(
  escape,
  // JSON strings cannot contain unescaped control characters. Keep this as a
  // predicate so lint does not mistake the source for a control character.
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

const jsonValue: Parser<JsonValue> = recursive(() =>
  choice(jsonNull, jsonBool, jsonNumber, jsonString, jsonArray, jsonObject)
)

const jsonArray: Parser<JsonValue[]> = between(
  token(char("[")),
  token(char("]")),
  sepBy(token(jsonValue), token(char(",")))
)

const jsonMember = parser(function* () {
  const key = yield* token(jsonString)
  yield* token(char(":"))
  const value = yield* token(jsonValue)
  return [key, value] as const
})

const jsonObject: Parser<{ [key: string]: JsonValue }> = between(
  token(char("{")),
  token(char("}")),
  sepBy(jsonMember, token(char(",")))
).map(pairs => Object.fromEntries(pairs))

export const json = token(jsonValue).zipLeft(eof)
