import { ParseError, SourceText, type Diagnostic, type Span } from "./errors.ts"

export type Reply<T> =
  | {
      readonly ok: true
      readonly value: T
      readonly offset: number
      readonly cut: boolean
    }
  | {
      readonly ok: false
      readonly offset: number
      readonly diagnostic: Diagnostic
      readonly cut: boolean
      readonly fatal: boolean
    }
export type Run<T> = (source: SourceText, offset: number) => Reply<T>
export type ParseResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: ParseError }
export type PrefixParseResult<T> =
  | {
      readonly success: true
      readonly value: T
      readonly offset: number
      readonly rest: string
    }
  | { readonly success: false; readonly error: ParseError }
const runner = Symbol("parser runner")

export interface Parser<T> {
  readonly [runner]: Run<T>
  map<B>(f: (value: T) => B): Parser<B>
  flatMap<B>(f: (value: T) => Parser<B>): Parser<B>
  zip<B>(other: Parser<B>): Parser<[T, B]>
  zipRight<B>(other: Parser<B>): Parser<B>
  zipLeft<B>(other: Parser<B>): Parser<T>
  [Symbol.iterator](): Generator<Parser<T>, T, unknown>
  expected(description: string): Parser<T>
  context(description: string): Parser<T>
  withSpan<B>(f: (value: T, span: Span) => B): Parser<B>
  validate(
    predicate: (value: T) => boolean | string,
    message?: string
  ): Parser<T>
  trim(trivia: Parser<unknown>): Parser<T>
  trimLeft(trivia: Parser<unknown>): Parser<T>
  trimRight(trivia: Parser<unknown>): Parser<T>
  commit(): Parser<T>
  parse(
    input: string,
    options?: { readonly sourceName?: string }
  ): ParseResult<T>
  parsePrefix(
    input: string,
    options?: { readonly sourceName?: string }
  ): PrefixParseResult<T>
  parseOrThrow(input: string, options?: { readonly sourceName?: string }): T
}
export const replySuccess = <T>(
  value: T,
  offset: number,
  cut = false
): Reply<T> => ({ ok: true, value, offset, cut })
export const replyFailure = (
  diagnostic: Diagnostic,
  offset: number,
  cut = false,
  fatal = false
): Reply<never> => ({ ok: false, diagnostic, offset, cut, fatal })
export const combineCut = <T>(reply: Reply<T>, cut: boolean): Reply<T> =>
  cut && !reply.cut ? { ...reply, cut: true } : reply

class ParserValue<T> implements Parser<T> {
  readonly [runner]: Run<T>
  constructor(run: Run<T>) {
    this[runner] = run
  }
  map<B>(f: (value: T) => B): Parser<B> {
    return makeParser((source, offset) => {
      const reply = runParser(this, source, offset)
      return reply.ok
        ? replySuccess(f(reply.value), reply.offset, reply.cut)
        : reply
    })
  }
  flatMap<B>(f: (value: T) => Parser<B>): Parser<B> {
    return makeParser((source, offset) => {
      const reply = runParser(this, source, offset)
      return reply.ok
        ? combineCut(runParser(f(reply.value), source, reply.offset), reply.cut)
        : reply
    })
  }
  zip<B>(other: Parser<B>): Parser<[T, B]> {
    return makeParser((source, offset) => {
      const left = runParser(this, source, offset)
      if (!left.ok) return left
      const right = runParser(other, source, left.offset)
      return right.ok
        ? replySuccess(
            [left.value, right.value],
            right.offset,
            left.cut || right.cut
          )
        : combineCut(right, left.cut)
    })
  }
  zipRight<B>(other: Parser<B>): Parser<B> {
    return makeParser((source, offset) => {
      const left = runParser(this, source, offset)
      return left.ok
        ? combineCut(runParser(other, source, left.offset), left.cut)
        : left
    })
  }
  zipLeft<B>(other: Parser<B>): Parser<T> {
    return makeParser((source, offset) => {
      const left = runParser(this, source, offset)
      if (!left.ok) return left
      const right = runParser(other, source, left.offset)
      return right.ok
        ? replySuccess(left.value, right.offset, left.cut || right.cut)
        : combineCut(right, left.cut)
    })
  }
  *[Symbol.iterator](): Generator<Parser<T>, T, unknown> {
    return (yield this) as T
  }
  expected(description: string): Parser<T> {
    return makeParser((source, offset) => {
      const reply = runParser(this, source, offset)
      if (reply.ok || reply.fatal) return reply
      const old =
        reply.diagnostic.kind === "custom"
          ? (({ message: _message, ...details }) => details)(reply.diagnostic)
          : reply.diagnostic
      return {
        ...reply,
        diagnostic: { ...old, kind: "expected", expected: [description] }
      }
    })
  }
  context(description: string): Parser<T> {
    return makeParser((source, offset) => {
      const reply = runParser(this, source, offset)
      return reply.ok
        ? reply
        : {
            ...reply,
            diagnostic: {
              ...reply.diagnostic,
              context: [...(reply.diagnostic.context ?? []), description]
            }
          }
    })
  }
  withSpan<B>(f: (value: T, span: Span) => B): Parser<B> {
    return makeParser((source, offset) => {
      const reply = runParser(this, source, offset)
      return reply.ok
        ? replySuccess(
            f(reply.value, { start: offset, end: reply.offset }),
            reply.offset,
            reply.cut
          )
        : reply
    })
  }
  validate(
    predicate: (value: T) => boolean | string,
    message = "valid value"
  ): Parser<T> {
    return this.flatMap(value => {
      const result = predicate(value)
      return result === true
        ? succeed(value)
        : fail(typeof result === "string" ? result : message)
    })
  }
  trim(trivia: Parser<unknown>): Parser<T> {
    return trivia.zipRight(this).zipLeft(trivia)
  }
  trimLeft(trivia: Parser<unknown>): Parser<T> {
    return trivia.zipRight(this)
  }
  trimRight(trivia: Parser<unknown>): Parser<T> {
    return this.zipLeft(trivia)
  }
  commit(): Parser<T> {
    return makeParser((source, offset) => {
      const reply = runParser(this, source, offset)
      return reply.ok ? combineCut(reply, true) : reply
    })
  }
  parse(
    input: string,
    options: { readonly sourceName?: string } = {}
  ): ParseResult<T> {
    const source = new SourceText(input, options.sourceName)
    const reply = runParser(this, source, 0)
    if (!reply.ok)
      return {
        success: false,
        error: new ParseError(reply.diagnostic, source, reply.fatal)
      }
    if (reply.offset < input.length)
      return {
        success: false,
        error: new ParseError(
          {
            kind: "expected",
            span: {
              start: reply.offset,
              end: reply.offset + source.charWidthAt(reply.offset)
            },
            expected: ["end of input"],
            found: source.charAt(reply.offset)
          },
          source
        )
      }
    return { success: true, value: reply.value }
  }
  parsePrefix(
    input: string,
    options: { readonly sourceName?: string } = {}
  ): PrefixParseResult<T> {
    const source = new SourceText(input, options.sourceName)
    const reply = runParser(this, source, 0)
    return reply.ok
      ? {
          success: true,
          value: reply.value,
          offset: reply.offset,
          rest: input.slice(reply.offset)
        }
      : {
          success: false,
          error: new ParseError(reply.diagnostic, source, reply.fatal)
        }
  }
  parseOrThrow(
    input: string,
    options: { readonly sourceName?: string } = {}
  ): T {
    const result = this.parse(input, options)
    if (!result.success) throw result.error
    return result.value
  }
}
export function runParser<T>(
  parser: Parser<T>,
  source: SourceText,
  offset: number
): Reply<T> {
  return parser[runner](source, offset)
}
export function makeParser<T>(run: Run<T>): Parser<T> {
  return new ParserValue(run)
}
export function succeed<T>(value: T): Parser<T> {
  return makeParser((_source, offset) => replySuccess(value, offset))
}
export function fail(message: string): Parser<never> {
  return makeParser((_source, offset) =>
    replyFailure(
      { kind: "custom", span: { start: offset, end: offset }, message },
      offset
    )
  )
}
export function fatal(message: string): Parser<never> {
  return makeParser((_source, offset) =>
    replyFailure(
      { kind: "custom", span: { start: offset, end: offset }, message },
      offset,
      false,
      true
    )
  )
}
export function parser<T>(
  f: () => Generator<Parser<unknown>, T, unknown>
): Parser<T> {
  return makeParser((source, offset) => {
    const iterator = f()
    let completed = false
    try {
      let current = iterator.next()
      let cut = false
      while (!current.done) {
        const reply = runParser(current.value, source, offset)
        cut ||= reply.cut
        if (!reply.ok) return combineCut(reply, cut)
        offset = reply.offset
        current = iterator.next(reply.value)
      }
      completed = true
      return replySuccess(current.value, offset, cut)
    } finally {
      if (!completed) {
        while (!iterator.return(undefined as never).done) {
          // Continue cancellation without running parsers yielded by finalizers.
        }
      }
    }
  })
}
export function recursive<T>(
  builder: (self: Parser<T>) => Parser<T>
): Parser<T> {
  let built: Parser<T> | undefined
  const self: Parser<T> = makeParser((source, offset) =>
    runParser((built ??= builder(self)), source, offset)
  )
  return self
}
