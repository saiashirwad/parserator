import {
  between,
  char,
  or,
  parser,
  Parser,
  regex,
  sepBy,
  string
} from "../src/index.ts"

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

const whitespace = regex(/\s*/)
const token = <T>(p: Parser<T>): Parser<T> => p.trimLeft(whitespace)

const jsonNull = string("null").map(() => null)

const jsonBool = or(
  string("true").map(() => true),
  string("false").map(() => false)
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

const escape = char("\\").then(
  or(
    regex(/u[0-9a-fA-F]{4}/).map(hex =>
      String.fromCharCode(parseInt(hex.slice(1), 16))
    ),
    regex(/["\\/bfnrt]/).map(c => escapes[c]!)
  )
)

const jsonString = parser(function* () {
  yield* char('"')
  const chars: string[] = []

  while (true) {
    const next = yield* or(
      escape,
      regex(/[^"\\]+/),
      char('"').map(() => null)
    )
    if (next === null) break
    chars.push(next)
  }

  return chars.join("")
})

const jsonValue: Parser<JsonValue> = Parser.lazy(() =>
  or(jsonNull, jsonBool, jsonNumber, jsonString, jsonArray, jsonObject)
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

export const json = token(jsonValue)
