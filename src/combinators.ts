import type { Diagnostic, SourceText } from "./errors.ts"
import { mergeDiagnostics } from "./diagnostic-merge.ts"
import {
  type Parser,
  type Reply,
  parser,
  makeParser,
  runParser,
  replySuccess,
  replyFailure,
  combineCut
} from "./parser.ts"
import type { SourcePosition } from "./state.ts"

const digitTest = (c: string) => c >= "0" && c <= "9"
const letterTest = (c: string) =>
  (c >= "a" && c <= "z") || (c >= "A" && c <= "Z")
const expected = (
  source: SourceText,
  offset: number,
  item: string
): Reply<never> =>
  replyFailure(
    {
      kind: "expected",
      span: { start: offset, end: offset + source.charWidthAt(offset) },
      expected: [item],
      ...(source.charAt(offset) ? { found: source.charAt(offset) } : {})
    },
    offset
  )

function literalDiagnostic(
  source: SourceText,
  offset: number,
  value: string
): Diagnostic {
  for (const point of value) {
    const width = source.charWidthAt(offset)
    if (source.text.slice(offset, offset + width) !== point)
      return {
        kind: "expected",
        span: { start: offset, end: offset + width },
        expected: [JSON.stringify(value)],
        ...(source.charAt(offset) ? { found: source.charAt(offset) } : {})
      }
    offset += width
  }
  return {
    kind: "expected",
    span: { start: offset, end: offset },
    expected: [JSON.stringify(value)]
  }
}
export const literal = <const S extends string>(value: S): Parser<S> =>
  makeParser((source, offset) =>
    source.text.startsWith(value, offset)
      ? replySuccess(value, offset + value.length)
      : replyFailure(literalDiagnostic(source, offset, value), offset)
  )
export const oneOfLiterals = <
  const Values extends readonly [string, ...string[]]
>(
  ...values: Values
): Parser<Values[number]> => {
  if (!values.length)
    throw new TypeError("oneOfLiterals requires at least one literal")
  const sorted = [...values].sort((a, b) => b.length - a.length)
  return makeParser((source, offset) => {
    for (const value of sorted)
      if (source.text.startsWith(value, offset))
        return replySuccess(value as Values[number], offset + value.length)
    return replyFailure(
      mergeDiagnostics(
        values.map(value => literalDiagnostic(source, offset, value)) as [
          Diagnostic,
          ...Diagnostic[]
        ]
      ),
      offset
    )
  })
}
export const char = <const C extends string>(value: C): Parser<C> => {
  const code = value.codePointAt(0)
  if (
    [...value].length !== 1 ||
    code === undefined ||
    (code >= 0xd800 && code <= 0xdfff)
  )
    throw new TypeError("char expects one Unicode code point")
  return makeParser((source, offset) =>
    source.charAt(offset) === value
      ? replySuccess(value, offset + source.charWidthAt(offset))
      : expected(source, offset, JSON.stringify(value))
  )
}
export function satisfy(
  predicate: (char: string) => boolean,
  description = "character"
): Parser<string> {
  return makeParser((source, offset) => {
    const value = source.charAt(offset)
    return value && predicate(value)
      ? replySuccess(value, offset + source.charWidthAt(offset))
      : expected(source, offset, description)
  })
}
export function anyChar(): Parser<string> {
  return satisfy(() => true, "any character")
}
export const digit = satisfy(digitTest, "digit")
export const asciiLetter = satisfy(letterTest, "ASCII letter")
export const asciiAlphanumeric = satisfy(
  c => letterTest(c) || digitTest(c),
  "ASCII alphanumeric character"
)
export const whitespace = satisfy(
  c => c === " " || c === "\t" || c === "\n" || c === "\r",
  "whitespace"
)
export function notFollowedBy<T>(inner: Parser<T>): Parser<true> {
  return makeParser((source, offset) => {
    const reply = runParser(inner, source, offset)
    if (!reply.ok) return reply.fatal ? reply : replySuccess(true, offset)
    return replyFailure(
      {
        kind: "unexpected",
        span: { start: offset, end: offset },
        found: source.charAt(offset),
        message: "Unexpected following input"
      },
      offset
    )
  })
}
export function lookahead<T>(inner: Parser<T>): Parser<T> {
  return makeParser((source, offset) => {
    const reply = runParser(inner, source, offset)
    if (reply.ok) return replySuccess(reply.value, offset)
    return reply.fatal
      ? { ...reply, cut: false }
      : { ...reply, offset, cut: false }
  })
}
export function probe<T>(inner: Parser<T>): Parser<T | undefined> {
  return optional(lookahead(inner))
}
export function takeWhileChar(
  predicate: (char: string) => boolean
): Parser<string> {
  return makeParser((source, offset) => {
    let end = offset
    while (end < source.text.length && predicate(source.charAt(end)))
      end += source.charWidthAt(end)
    return replySuccess(source.text.slice(offset, end), end)
  })
}
export function takeWhileChar1(
  predicate: (char: string) => boolean,
  description: string
): Parser<string> {
  const inner = takeWhileChar(predicate)
  return makeParser((source, offset) => {
    const reply = runParser(inner, source, offset)
    return reply.ok && reply.offset === offset
      ? expected(source, offset, description)
      : reply
  })
}
export function between<T>(
  start: Parser<unknown>,
  end: Parser<unknown>,
  inner: Parser<T>
): Parser<T> {
  return start.zipRight(inner).zipLeft(end.expected("closing delimiter"))
}
function ensureCount(n: number): void {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError("count must be a safe nonnegative integer")
}
function repeat<T>(
  inner: Parser<T>,
  min: number,
  max: number,
  collect: true
): Parser<T[]>
function repeat<T>(
  inner: Parser<T>,
  min: number,
  max: number,
  collect: false
): Parser<void>
function repeat<T>(
  inner: Parser<T>,
  min: number,
  max: number,
  collect: boolean
): Parser<T[] | void> {
  return makeParser((source, offset) => {
    const values = collect ? ([] as T[]) : undefined
    let cut = false
    for (let n = 0; n < max; n++) {
      const reply = runParser(inner, source, offset)
      if (!reply.ok) {
        if (reply.fatal || reply.cut || n < min) return combineCut(reply, cut)
        return replySuccess(values, offset, cut)
      }
      if (max === Infinity && reply.offset <= offset)
        throw new Error("repeated parser must consume input")
      values?.push(reply.value)
      offset = reply.offset
      cut ||= reply.cut
    }
    return replySuccess(values, offset, cut)
  })
}
export function many<T>(inner: Parser<T>): Parser<T[]>
export function many(inner: Parser<any>): Parser<any>
export function many<T>(inner: Parser<T>): Parser<T[]> {
  return repeat(inner, 0, Infinity, true)
}
export function many1<T>(inner: Parser<T>): Parser<T[]>
export function many1(inner: Parser<any>): Parser<any>
export function many1<T>(inner: Parser<T>): Parser<T[]> {
  return repeat(inner, 1, Infinity, true)
}
export function skipMany<T>(inner: Parser<T>): Parser<void>
export function skipMany(inner: Parser<any>): Parser<any>
export function skipMany<T>(inner: Parser<T>): Parser<void> {
  return repeat(inner, 0, Infinity, false)
}
export function atLeast<T>(inner: Parser<T>, n: number): Parser<T[]> {
  ensureCount(n)
  return repeat(inner, n, Infinity, true)
}
export function count<T>(inner: Parser<T>, n: number): Parser<T[]> {
  ensureCount(n)
  return repeat(inner, n, n, true)
}
export function optional<T>(inner: Parser<T>): Parser<T | undefined>
export function optional(inner: Parser<any>): Parser<any>
export function optional<T>(inner: Parser<T>): Parser<T | undefined> {
  return makeParser((source, offset) => {
    const reply = runParser(inner, source, offset)
    return reply.ok || reply.fatal || reply.cut
      ? reply
      : replySuccess(undefined, offset)
  })
}
function list<T, S>(
  inner: Parser<T>,
  separator: Parser<S>,
  allowTrailing: boolean,
  requireOne: boolean
): Parser<T[]> {
  return makeParser((source, offset) => {
    const first = runParser(inner, source, offset)
    if (!first.ok)
      return !requireOne && !first.fatal && !first.cut
        ? replySuccess([], offset)
        : first
    if (first.offset <= offset) throw new Error("list item must consume input")
    const values = [first.value]
    offset = first.offset
    let cut = first.cut
    while (true) {
      const sep = runParser(separator, source, offset)
      if (!sep.ok)
        return sep.fatal || sep.cut
          ? combineCut(sep, cut)
          : replySuccess(values, offset, cut)
      const item = runParser(inner, source, sep.offset)
      if (!item.ok) {
        if (item.fatal || item.cut || sep.cut || !allowTrailing)
          return combineCut(item, cut || sep.cut)
        return replySuccess(values, sep.offset, cut)
      }
      if (item.offset <= sep.offset)
        throw new Error("list item must consume input")
      if (item.offset <= offset)
        throw new Error("list iteration must consume input")
      values.push(item.value)
      offset = item.offset
      cut ||= sep.cut || item.cut
    }
  })
}
export const sepBy = <T, S>(
  inner: Parser<T>,
  separator: Parser<S>
): Parser<T[]> => list(inner, separator, false, false)
export const sepBy1 = <T, S>(
  inner: Parser<T>,
  separator: Parser<S>
): Parser<T[]> => list(inner, separator, false, true)
export const sepEndBy = <T, S>(
  inner: Parser<T>,
  separator: Parser<S>
): Parser<T[]> => list(inner, separator, true, false)
export const sepEndBy1 = <T, S>(
  inner: Parser<T>,
  separator: Parser<S>
): Parser<T[]> => list(inner, separator, true, true)
function scanUntil<T>(inner: Parser<T>, consumeMatch: boolean): Parser<string> {
  return makeParser((source, offset) => {
    let current = offset
    while (true) {
      const reply = runParser(inner, source, current)
      if (reply.ok)
        return replySuccess(
          source.text.slice(offset, current),
          consumeMatch ? reply.offset : current
        )
      if (reply.fatal) return reply
      if (current >= source.text.length)
        return replySuccess(source.text.slice(offset), current)
      current += source.charWidthAt(current)
    }
  })
}
export const takeUntil = <T>(inner: Parser<T>): Parser<string> =>
  scanUntil(inner, true)
export const takeUpto = <T>(inner: Parser<T>): Parser<string> =>
  scanUntil(inner, false)
export const skipUntil = <T>(inner: Parser<T>): Parser<void> =>
  scanUntil(inner, true).map(() => undefined)
export function choice<
  Parsers extends readonly [Parser<any>, ...Parser<any>[]]
>(
  ...parsers: Parsers
): Parser<Parsers[number] extends Parser<infer T> ? T : never>
export function choice(...parsers: Parser<any>[]): Parser<any> {
  if (!parsers.length)
    throw new TypeError("choice requires at least one parser")
  return makeParser((source, offset) => {
    const diagnostics: Diagnostic[] = []
    for (const alternative of parsers) {
      const reply = runParser(alternative, source, offset)
      if (reply.ok || reply.fatal || reply.cut) return reply
      diagnostics.push(reply.diagnostic)
    }
    return replyFailure(
      mergeDiagnostics(diagnostics as [Diagnostic, ...Diagnostic[]]),
      offset
    )
  })
}
export const sequence = <const Parsers extends readonly Parser<unknown>[]>(
  parsers: Parsers
): Parser<{
  -readonly [K in keyof Parsers]: Parsers[K] extends Parser<infer T> ? T : never
}> =>
  parser(function* () {
    const values: unknown[] = []
    for (const item of parsers) values.push(yield* item)
    return values as {
      -readonly [K in keyof Parsers]: Parsers[K] extends Parser<infer T>
        ? T
        : never
    }
  })
export const regex = (expression: RegExp): Parser<string> => {
  const sticky = new RegExp(
    expression.source,
    `${expression.flags.replace(/[gy]/g, "")}y`
  )
  return makeParser((source, offset) => {
    sticky.lastIndex = offset
    const match = sticky.exec(source.text)
    return match?.index === offset
      ? replySuccess(
          source.text.slice(offset, sticky.lastIndex),
          sticky.lastIndex
        )
      : expected(source, offset, expression.toString())
  })
}
export const eof = makeParser<void>((source, offset) =>
  offset >= source.text.length
    ? replySuccess(undefined, offset)
    : expected(source, offset, "end of input")
)
export const position: Parser<SourcePosition> = makeParser((source, offset) =>
  replySuccess({ ...source.positionAt(offset), offset }, offset)
)
export const commit = (): Parser<void> =>
  makeParser((_source, offset) => replySuccess(undefined, offset, true))
export function attempt<T>(inner: Parser<T>): Parser<T> {
  return makeParser((source, offset) => {
    const reply = runParser(inner, source, offset)
    return reply.ok || reply.fatal ? reply : { ...reply, offset, cut: false }
  })
}
