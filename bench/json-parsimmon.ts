/**
 * JSON parser written in Parsimmon, mirroring examples/json-parser.ts as
 * closely as possible so the comparison is apples-to-apples.
 */
import P from "parsimmon"

const whitespace = P.regexp(/\s*/)
const token = <T>(p: P.Parser<T>): P.Parser<T> => whitespace.then(p)

const jsonNull = P.string("null").result(null)

const jsonBool = P.alt(
  P.string("true").result(true),
  P.string("false").result(false)
)

const jsonNumber = P.regexp(
  /-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/
).map(Number)

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

const escape = P.string("\\").then(
  P.alt(
    P.regexp(/u[0-9a-fA-F]{4}/).map(hex =>
      String.fromCharCode(parseInt(hex.slice(1), 16))
    ),
    P.regexp(/["\\/bfnrt]/).map(c => escapes[c]!)
  )
)

const jsonString = P.string('"')
  .then(P.alt(escape, P.regexp(/[^"\\]+/)).many())
  .skip(P.string('"'))
  .map(chars => chars.join(""))

const jsonValue: P.Parser<unknown> = P.lazy(() =>
  P.alt(jsonNull, jsonBool, jsonNumber, jsonString, jsonArray, jsonObject)
)

const jsonArray = token(P.string("["))
  .then(token(jsonValue).sepBy(token(P.string(","))))
  .skip(token(P.string("]")))

const jsonMember = P.seq(
  token(jsonString),
  token(P.string(":")).then(token(jsonValue))
)

const jsonObject = token(P.string("{"))
  .then(jsonMember.sepBy(token(P.string(","))))
  .skip(token(P.string("}")))
  .map(pairs => Object.fromEntries(pairs))

export const json = token(jsonValue)

export function parseJson(input: string): unknown {
  const result = json.parse(input)
  if (!result.status) throw new Error("parsimmon parse failed")
  return result.value
}
