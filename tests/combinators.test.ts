import { describe, expect, test, vi } from "vitest"
import {
  anyChar,
  atLeast,
  between,
  char,
  choice,
  commit,
  count,
  digit,
  eof,
  fail,
  fatal,
  literal,
  oneOfLiterals,
  lookahead,
  many,
  many1,
  notFollowedBy,
  optional,
  parser,
  probe,
  regex,
  sepBy,
  sepBy1,
  sepEndBy,
  sepEndBy1,
  sequence,
  skipMany,
  succeed,
  skipUntil,
  takeUntil,
  takeUpto,
  attempt
} from "../src/index"
import { peekUntil } from "../src/utils"
import { ParseError } from "../src/index"
import type { ParseResult, Parser as ParserType } from "../src/index"

const succeeds = <T>(result: ParseResult<T>): T => {
  expect(result.success).toBe(true)
  if (!result.success) throw result.error
  return result.value
}

const fails = <T>(result: ParseResult<T>): ParseError => {
  expect(result.success).toBe(false)
  if (result.success) throw new Error("expected a parse failure")
  return result.error
}

describe("parse boundary and results", () => {
  test("parse consumes the complete input", () => {
    expect(literal("abc").parse("abc")).toEqual({
      success: true,
      value: "abc"
    })
    expect(literal("abc").parse("abc!").success).toBe(false)
  })

  test("parsePrefix exposes the unconsumed suffix", () => {
    expect(literal("abc").parsePrefix("abc!")).toEqual({
      success: true,
      value: { value: "abc", offset: 3, rest: "!" }
    })
  })

  test("complete trailing-input errors point at the trailing input", () => {
    const error = fails(literal("a").context("top-level value").parse("ab"))
    expect(error.diagnostic.span).toEqual({ start: 1, end: 2 })
    expect(error.diagnostic.expected).toContain("end of input")
    expect(error.diagnostic.context).toEqual(["top-level value"])
  })

  test("parseOrThrow returns values and throws ParseError", () => {
    expect(literal("ok").parseOrThrow("ok")).toBe("ok")
    const invoke = () => literal("ok").parseOrThrow("no")
    expect(invoke).toThrowError()
    try {
      invoke()
    } catch (caught) {
      expect(caught).toBeInstanceOf(Error)
      expect(caught).toBeInstanceOf(ParseError)
    }
  })

  test("Promise resolution does not treat Parser as a thenable", async () => {
    const p = literal("ok")
    expect("then" in p).toBe(false)
    await expect(Promise.resolve(p)).resolves.toBe(p)
  })
})

describe("errors", () => {
  test("errors are Error instances with formatting and JSON", () => {
    const error = fails(
      sequence([literal("a"), literal("b").expected("the second letter")])
        .context("pair")
        .parse("ac", { sourceName: "input.dsl" })
    )

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("ParseError")
    expect(error.format({ style: "plain" })).toContain("the second letter")
    expect(error.format({ style: "plain" })).toContain("pair")
    expect(error.format({ style: "plain" })).toContain("input.dsl")
    expect(error.format({ style: "plain" })).toContain("column 2")
    expect(error.toJSON()).toEqual(expect.any(Object))
    expect(JSON.stringify(error.toJSON())).toContain("second letter")
    expect(error.toJSON().sourceName).toBe("input.dsl")
  })

  test("source positions handle CRLF line breaks", () => {
    const error = fails(
      sequence([literal("a"), literal("\r\n"), literal("b")]).parse("a\r\nc")
    )
    expect(error.format({ style: "plain" })).toContain("line 2, column 1")
  })

  test("source positions handle bare carriage returns", () => {
    const error = fails(
      sequence([literal("a"), literal("\r"), literal("b")]).parse("a\rc")
    )
    expect(error.format({ style: "plain" })).toContain("line 2, column 1")
  })

  test("choice merges expected items at the furthest tied offset", () => {
    const error = fails(
      choice(literal("a"), literal("a"), literal("b")).parse("c")
    )
    expect(error.diagnostic.kind).toBe("expected")
    expect(error.diagnostic.expected).toEqual(['"a"', '"b"'])
    const rendered = error.format({ style: "plain" })
    expect(rendered).toContain("a")
    expect(rendered).toContain("b")
  })

  test("an explicit custom diagnostic wins over a primitive at the same offset", () => {
    const error = fails(choice(literal("b"), fail("custom token")).parse("c"))
    expect(error.diagnostic.kind).toBe("custom")
    expect(error.diagnostic.message).toBe("custom token")
    expect(error.diagnostic.expected).toBeUndefined()
    expect(error.format({ style: "plain" })).toContain("custom token")
  })

  test("choice requires at least one parser at runtime", () => {
    expect(() =>
      (choice as unknown as (...args: never[]) => unknown)()
    ).toThrow()
  })
})

describe("commit, attempt, and fatal control", () => {
  const cleanFailure = literal("b")
  const consumedFailure = sequence([literal("a"), literal("b")])
  const cutFailure = parser(function* () {
    yield* literal("a")
    yield* commit()
    yield* literal("b")
    return undefined
  })
  const fatalFailure = parser(function* () {
    yield* literal("a")
    yield* fatal("fatal branch")
    return undefined
  })

  const cases = [
    ["clean failure", cleanFailure, "a"],
    ["consuming failure without cut", consumedFailure, "a"],
    ["failure after cut", cutFailure, "a"],
    ["fatal failure", fatalFailure, "a"]
  ] as const

  test.each(cases)("choice control: %s", (name, inner, input) => {
    const result = choice(inner, literal("a")).parsePrefix(input)
    if (name === "failure after cut" || name === "fatal failure") {
      expect(result.success).toBe(false)
    } else {
      expect(succeeds(result).value).toBe("a")
    }
  })

  test.each(cases)("optional control: %s", (name, inner, input) => {
    const result = optional(inner).parsePrefix(input)
    if (name === "failure after cut" || name === "fatal failure") {
      expect(result.success).toBe(false)
    } else {
      expect(succeeds(result).value).toBeUndefined()
    }
  })

  test.each(cases)("many control: %s", (name, inner, input) => {
    const result = many(inner).parsePrefix(input)
    if (name === "failure after cut" || name === "fatal failure") {
      expect(result.success).toBe(false)
    } else {
      expect(succeeds(result).value).toEqual([])
    }
  })

  test.each(cases)("skipMany control: %s", (name, inner, input) => {
    const result = skipMany(inner).parsePrefix(input)
    if (name === "failure after cut" || name === "fatal failure") {
      expect(result.success).toBe(false)
    } else {
      expect(result.success).toBe(true)
    }
  })

  test("a choice created after an earlier cut has a fresh boundary", () => {
    const p = parser(function* () {
      yield* commit()
      return yield* choice(literal("b"), literal("a"))
    })
    expect(p.parse("a")).toEqual({ success: true, value: "a" })
  })

  test("attempt isolates a cut made by a failed branch", () => {
    expect(
      succeeds(choice(attempt(cutFailure), literal("a")).parsePrefix("a")).value
    ).toBe("a")
  })

  test("fatal failures are not recovered by attempt", () => {
    const result = choice(attempt(fatalFailure), literal("a")).parse("a")
    expect(result.success).toBe(false)
    expect(fails(result).format({ style: "plain" })).toContain("fatal branch")
  })

  test("attempt preserves a cut made by a successful parser", () => {
    const committedSuccess = parser(function* () {
      yield* literal("a")
      yield* commit()
      return "a"
    })
    const branch = parser(function* () {
      yield* attempt(committedSuccess)
      yield* literal("b")
      return "ab"
    })

    const result = choice(branch, literal("a")).parsePrefix("ac")
    expect(result.success).toBe(false)
  })

  test("expected does not soften a fatal diagnostic", () => {
    const result = choice(
      fatal("fatal diagnostic").expected("friendly label"),
      literal("a")
    ).parse("b")
    const error = fails(result)
    expect(error.diagnostic.kind).toBe("fatal")
    expect(error.format({ style: "plain" })).toContain("fatal diagnostic")
  })

  test("an expected-wrapped fatal stays fatal through every control boundary", () => {
    const wrapped = fatal("wrapped fatal").expected("friendly fatal")
    const boundaries: ParserType<any>[] = [
      choice(wrapped, literal("a")),
      attempt(wrapped),
      lookahead(wrapped),
      probe(wrapped),
      takeUntil(wrapped),
      takeUpto(wrapped),
      skipUntil(wrapped)
    ]
    for (const boundary of boundaries) {
      const error = fails(boundary.parse("x"))
      expect(error.diagnostic.kind).toBe("fatal")
      expect(error.format({ style: "plain" })).toContain("wrapped fatal")
    }
  })

  test("an outer cut propagates through nested boundaries, while attempt isolates it", () => {
    const freshCutFailure = parser(function* () {
      yield* commit()
      yield* literal("b")
      return undefined
    })
    const outer = <T>(inner: ParserType<T>) =>
      parser(function* () {
        yield* commit()
        return yield* inner
      })

    for (const inner of [
      optional(freshCutFailure),
      many(freshCutFailure),
      sepBy(freshCutFailure, literal(",")),
      sepEndBy(freshCutFailure, literal(","))
    ]) {
      expect(outer(inner).parsePrefix("a").success).toBe(false)
    }

    for (const inner of [
      optional(attempt(freshCutFailure)),
      many(attempt(freshCutFailure)),
      sepBy(attempt(freshCutFailure), literal(",")),
      sepEndBy(attempt(freshCutFailure), literal(","))
    ]) {
      expect(outer(inner).parsePrefix("a").success).toBe(true)
    }

    // A choice boundary created after the outer cut still starts at the
    // current generation and can try its next ordinary alternative.
    const nestedChoice = choice(literal("b"), literal("a"))
    expect(outer(optional(nestedChoice)).parse("a").success).toBe(true)
    expect(outer(many(nestedChoice)).parse("a").success).toBe(true)
    expect(outer(sepBy(nestedChoice, literal(","))).parse("a").success).toBe(
      true
    )
    expect(outer(sepEndBy(nestedChoice, literal(","))).parse("a").success).toBe(
      true
    )
  })
})

describe("diagnostic wrappers and zero-width parsers", () => {
  test("withSpan captures a half-open UTF-16 span", () => {
    const p = literal("👋").withSpan((value, span) => ({
      value,
      start: span.start,
      end: span.end
    }))
    expect(succeeds(p.parse("👋"))).toEqual({
      value: "👋",
      start: 0,
      end: 2
    })
  })

  test("validate turns semantic rejection into a recoverable parse error", () => {
    const p = regex(/[0-9]+/).validate(
      value => Number(value) < 10,
      "a single-digit number"
    )
    expect(succeeds(p.parse("7"))).toBe("7")
    expect(fails(p.parse("12")).format({ style: "plain" })).toContain(
      "a single-digit number"
    )
  })

  test("expected and context preserve the real failure offset and control", () => {
    const branch = parser(function* () {
      yield* literal("a")
      yield* commit()
      yield* literal("b").expected("a b separator")
      return undefined
    }).context("branch")
    const result = choice(branch, literal("a")).parse("ac")
    const error = fails(result)
    const text = error.format({ style: "plain" })
    expect(text).toContain("a b separator")
    expect(text).toContain("branch")
    expect(text).toContain("column 2")
  })

  test("lookahead succeeds or fails without consuming input", () => {
    const p = sequence([lookahead(literal("a")), literal("a")])
    expect(succeeds(p.parse("a"))).toEqual(["a", "a"])
    expect(lookahead(literal("a")).parse("b").success).toBe(false)
  })

  test("probe returns undefined on an ordinary mismatch", () => {
    const p = sequence([probe(literal("a")), literal("b")])
    expect(succeeds(p.parse("b"))).toEqual([undefined, "b"])
  })

  test("notFollowedBy is zero-width and fails at the entry position", () => {
    expect(
      succeeds(sequence([notFollowedBy(literal("a")), literal("b")]).parse("b"))
    ).toEqual([true, "b"])
    const error = fails(notFollowedBy(literal("a")).parse("a"))
    expect(error.format({ style: "plain" })).toContain("column 1")
  })

  test("zero-width probes do not swallow fatal errors", () => {
    const fatalParser = fatal("probe fatal")
    expect(probe(fatalParser).parse("").success).toBe(false)
    expect(lookahead(fatalParser).parse("").success).toBe(false)
    expect(notFollowedBy(fatalParser).parse("").success).toBe(false)
  })

  test("zero-width probes and scanners isolate fresh recoverable cuts", () => {
    const cutMismatch = parser(function* () {
      yield* commit()
      yield* literal("b")
      return undefined
    })

    expect(
      succeeds(sequence([probe(cutMismatch), literal("a")]).parse("a"))
    ).toEqual([undefined, "a"])
    expect(
      succeeds(choice(lookahead(cutMismatch), literal("a")).parse("a"))
    ).toBe("a")
    expect(succeeds(notFollowedBy(cutMismatch).parsePrefix("a")).value).toBe(
      true
    )

    expect(succeeds(takeUntil(cutMismatch).parse("a"))).toBe("a")
    expect(succeeds(takeUpto(cutMismatch).parse("a"))).toBe("a")
    expect(skipUntil(cutMismatch).parse("a").success).toBe(true)
  })
})

describe("repetition and sequence", () => {
  test("repetition rejects parsers that make no progress", () => {
    expect(() => many(succeed("x")).parsePrefix("input")).toThrow(
      /consume input/
    )
    expect(() => skipMany(succeed("x")).parsePrefix("input")).toThrow(
      /consume input/
    )
    expect(() => sepBy(succeed("x"), literal(",")).parse(",")).toThrow(
      /consume input/
    )
  })

  test("skipMany discards each repeated value", () => {
    const marker = {}
    const originalPush = Array.prototype.push
    Array.prototype.push = function <T>(this: T[], ...items: T[]): number {
      if (items.some(item => item === marker))
        throw new Error("skipMany retained a value")
      return Reflect.apply(originalPush, this, items) as number
    }

    let result: ParseResult<void> | undefined
    try {
      result = skipMany(digit.map(() => marker)).parse("123")
    } finally {
      Array.prototype.push = originalPush
    }

    expect(result).toEqual({ success: true, value: undefined })
  })

  test("many1 and atLeast enforce their lower bounds", () => {
    expect(succeeds(many1(digit).parse("123"))).toEqual(["1", "2", "3"])
    expect(many1(digit).parse("").success).toBe(false)
    expect(succeeds(atLeast(digit, 2).parse("123"))).toEqual(["1", "2", "3"])
    expect(atLeast(digit, 2).parse("1").success).toBe(false)
  })

  test("count parses exactly n items and validates n", () => {
    expect(succeeds(count(digit, 3).parse("123"))).toEqual(["1", "2", "3"])
    expect(count(digit, 3).parse("12").success).toBe(false)
    for (const n of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => count(digit, n)).toThrow()
    }
  })

  test("separated list variants have distinct trailing behavior", () => {
    expect(succeeds(sepBy(digit, literal(",")).parse("1,2"))).toEqual([
      "1",
      "2"
    ])
    expect(sepBy(digit, literal(",")).parse("1,").success).toBe(false)
    expect(succeeds(sepEndBy(digit, literal(",")).parse("1,"))).toEqual(["1"])
    expect(succeeds(sepEndBy(digit, literal(",")).parse(""))).toEqual([])
    expect(sepBy1(digit, literal(",")).parse("").success).toBe(false)
    expect(sepEndBy1(digit, literal(",")).parse("").success).toBe(false)
  })

  test("between and eof compose with complete parsing", () => {
    const p = between(literal("("), literal(")"), many1(digit))
    expect(succeeds(p.parse("(123)"))).toEqual(["1", "2", "3"])
    expect(p.parse("(123)tail").success).toBe(false)
    expect(succeeds(sequence([literal("ok"), eof]).parse("ok"))).toEqual([
      "ok",
      undefined
    ])
  })
})

describe("primitive correctness", () => {
  test("literal mismatch spans start at the first differing code unit", () => {
    const mismatch = fails(literal("abc").parse("abx"))
    expect(mismatch.diagnostic.span).toEqual({ start: 2, end: 3 })

    const eof = fails(literal("abc").parse("ab"))
    expect(eof.diagnostic.span).toEqual({ start: 2, end: 2 })
  })

  test("Unicode diagnostics never expose a lone surrogate as found text", () => {
    const error = fails(
      sequence([literal("👋"), literal("x")]).parse("👋\uD83D")
    )
    const found = error.diagnostic.found ?? ""
    expect(found.length).toBeGreaterThan(0)
    expect(
      [...found].some(char => {
        const code = char.charCodeAt(0)
        return code >= 0xd800 && code <= 0xdfff
      })
    ).toBe(false)
  })

  test("literal and oneOfLiterals preserve longest and literal matches", () => {
    expect(succeeds(oneOfLiterals("let", "letter").parse("letter"))).toBe(
      "letter"
    )
    expect(succeeds(literal("let").parse("let"))).toBe("let")
  })

  test("regex preserves flags while matching at the current offset", () => {
    expect(succeeds(regex(/foo/i).parse("FOO"))).toBe("FOO")
    expect(succeeds(regex(/a.b/s).parse("a\nb"))).toBe("a\nb")
    expect(succeeds(regex(/foo/g).parse("foo"))).toBe("foo")
    expect(succeeds(regex(/😀/u).parse("😀"))).toBe("😀")
  })

  test("Unicode regex cannot move a sticky match before the current offset", () => {
    const splitSurrogate = regex(/./).zipRight(regex(/(?=😀)/u))
    expect(() => splitSurrogate.parse("😀")).not.toThrow()
    expect(splitSurrogate.parse("😀").success).toBe(false)
    expect(regex(/./).zipRight(regex(/😀/u)).parse("😀").success).toBe(false)
  })

  test("character parsers consume Unicode code points", () => {
    expect(succeeds(sequence([char("👋"), anyChar()]).parse("👋a"))).toEqual([
      "👋",
      "a"
    ])
    const prefix = anyChar().parsePrefix("👋!")
    expect(prefix).toEqual({
      success: true,
      value: { value: "👋", offset: 2, rest: "!" }
    })
  })

  test("scan-until advances by Unicode code point", () => {
    expect(succeeds(takeUpto(literal("x")).parsePrefix("👋x")).value).toBe("👋")
    expect(succeeds(takeUntil(literal("x")).parse("👋x"))).toBe("👋")
  })
})

describe("recovery helpers and utilities", () => {
  test("take/skip until propagate fatal probe failures", () => {
    const fatalParser = fatal("search fatal")
    expect(takeUntil(fatalParser).parse("abc").success).toBe(false)
    expect(takeUpto(fatalParser).parse("abc").success).toBe(false)
    expect(skipUntil(fatalParser).parse("abc").success).toBe(false)
  })

  test("peekUntil returns all remaining input when the delimiter is absent", () => {
    expect(peekUntil("!").parsePrefix("abc")).toEqual({
      success: true,
      value: { value: "abc", offset: 0, rest: "abc" }
    })
  })

  test("the generator is closed when parsing exits on failure", () => {
    const cleanup = vi.fn()
    const p = parser(function* () {
      try {
        yield* literal("a")
        yield* literal("b")
        return "ok"
      } finally {
        cleanup()
      }
    })
    expect(p.parse("ac").success).toBe(false)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
