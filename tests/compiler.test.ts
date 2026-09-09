import { describe, expect, test, vi } from "vitest"
import {
  anyChar,
  atLeast,
  attempt,
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
  lookahead,
  many,
  many1,
  notFollowedBy,
  oneOfLiterals,
  optional,
  parser,
  position,
  probe,
  recursive,
  regex,
  sepBy,
  sepBy1,
  sepEndBy,
  sepEndBy1,
  sequence,
  skipMany,
  succeed,
  takeUntil,
  takeUpto,
  takeWhileChar1,
  type Parser
} from "../src/index.ts"
import {
  makeParser,
  ParserOutput,
  replySuccess,
  runParser,
  State
} from "../src/advanced.ts"
import { json } from "../examples/json-parser.ts"
import { query } from "../examples/query-language/parser.ts"
import { program } from "../examples/js-parser.ts"
import { expr } from "../examples/toyml/parser.ts"
import { satisfy } from "../src/combinators.ts"

function equivalent(p: Parser<unknown>, inputs: readonly string[]): void {
  const fast = p.compile()
  for (const input of inputs) {
    // Repeated calls also exercise lazily compiled generator/flatMap children.
    for (let iteration = 0; iteration < 3; iteration++) {
      for (const state of [
        State.fromInput(input),
        {
          source: `!${input}`,
          offset: 1,
          cutGeneration: 7,
          completionContext: ["outer"],
          extra: 42
        }
      ]) {
        expect(runParser(fast, state)).toEqual(runParser(p, state))
      }
      for (const method of ["parse", "parsePrefix"] as const) {
        const result = fast[method](input, { sourceName: "fixture" })
        const expected = p[method](input, { sourceName: "fixture" })
        expect(result.success).toBe(expected.success)
        if (result.success && expected.success)
          expect(result.value).toEqual(expected.value)
        else if (!result.success && !expected.success) {
          expect(result.error.toJSON()).toEqual(expected.error.toJSON())
          expect(result.error.format({ style: "plain" })).toBe(
            expected.error.format({ style: "plain" })
          )
        }
      }
    }
  }
}

describe("compiled parsers", () => {
  test("returns a cached, composable parser and leaves the original alone", () => {
    const original = literal("a").map(value => ({ value }))
    const fast = original.compile()
    expect(fast).not.toBe(original)
    expect(original.compile()).toBe(fast)
    expect(fast.compile()).toBe(fast)
    expect(fast.zipLeft(literal("b")).parseOrThrow("ab")).toEqual({
      value: "a"
    })
    expect(
      parser(function* () {
        return yield* fast
      })
        .compile()
        .parseOrThrow("a")
    ).toEqual({ value: "a" })
    expect(original.parseOrThrow("a")).toEqual({ value: "a" })
    expect(() => fast.parseOrThrow("z")).toThrow()
  })

  test("preserves primitives, Unicode, regex flags, and partial matches", () => {
    const primitives = [
      literal(""),
      literal("abc"),
      literal("👋x"),
      literal("\ud800"),
      char("a"),
      char("👋"),
      char("�"),
      anyChar(),
      digit,
      eof,
      position,
      oneOfLiterals("a", "abc"),
      succeed({ marker: true }),
      fail("no"),
      fatal("stop"),
      regex(/a+/giy),
      regex(/a.b/s),
      regex(/./u),
      regex(/(?=👋)/u),
      regex(/^a/m),
      takeWhileChar1(c => c !== "!", "non-bang"),
      regex(/./).zipRight(regex(/👋/u))
    ]
    for (const p of primitives)
      equivalent(p, [
        "",
        "a",
        "abc",
        "ab!",
        "12",
        "👋x",
        "\ud800",
        "\udc00",
        "a\nb"
      ])
  })

  test("character alternatives recognize replacement characters for malformed UTF-16", () => {
    equivalent(choice(char("�"), literal("x")), [
      "\ud800",
      "\udc00",
      "�",
      "x",
      "!"
    ])
  })

  test("sequence observes changes to a caller-owned parser array", () => {
    const items: Parser<string>[] = [literal("a")]
    const p = sequence(items)
    const fast = p.compile()
    items.push(literal("b"))
    expect(fast.parseOrThrow("ab")).toEqual(p.parseOrThrow("ab"))
    items[0] = literal("x")
    expect(fast.parseOrThrow("xb")).toEqual(p.parseOrThrow("xb"))
    items.length = 0
    expect(fast.parseOrThrow("")).toEqual([])
    items.push(
      literal("a").map(value => {
        items.length = 1
        return value
      }),
      literal("b")
    )
    expect(fast.parseOrThrow("a")).toEqual(["a"])
  })

  test("preserves composition, values, spans, validation, and completion context", () => {
    const a = literal("a").context("letter")
    const b = literal("b").context("second")
    for (const p of [
      a.map(value => value.toUpperCase()),
      a.zip(b),
      a.zipLeft(b),
      a.zipRight(b),
      a.flatMap(() => b),
      a.expected("A").context("outer"),
      a.withSpan((value, span) => ({ value, span })),
      a.validate(() => false, "rejected"),
      a.validate(() => "reason"),
      a.validate(() => true),
      a.trim(regex(/ */)),
      a.trimLeft(regex(/ */)),
      a.trimRight(regex(/ */)),
      sequence([]),
      sequence([a, b]),
      count(a, 0),
      count(a, 2)
    ])
      equivalent(p, ["", "a", "b", "ab", "aa", "ab!", " a "])
  })

  test("preserves backtracking, cuts, fatal failures, and diagnostics at every boundary", () => {
    const branches = [
      literal("b"),
      literal("a").zipRight(literal("b")),
      literal("a").commit().zipRight(literal("b")),
      commit().zipRight(literal("b")),
      literal("a").zipRight(fatal("stop")),
      fatal("fatal").expected("friendly"),
      literal("abc").expected("word").context("branch"),
      literal("ab").zipRight(fail("custom"))
    ]
    for (const branch of branches) {
      for (const p of [
        choice(branch, literal("a")),
        optional(branch),
        many(branch),
        skipMany(branch),
        many1(branch),
        atLeast(branch, 2),
        attempt(branch),
        lookahead(branch),
        probe(branch),
        notFollowedBy(branch),
        choice(attempt(branch), literal("a")),
        commit().zipRight(choice(branch, literal("a"))),
        sepBy(branch, literal(",")),
        sepEndBy(branch, literal(",")),
        takeUntil(branch),
        takeUpto(branch)
      ])
        equivalent(p, ["", "a", "ab", "ac", "abc", "a,a", "ab,ac"])
    }
    equivalent(
      choice(
        literal("abc"),
        literal("abd").context("specific"),
        fail("custom")
      ),
      ["ab!", ""]
    )
  })

  test("preserves list separators and repetition progress checks", () => {
    for (const list of [sepBy, sepBy1, sepEndBy, sepEndBy1]) {
      for (const separator of [
        literal(","),
        literal(",").commit(),
        literal(",").zipRight(fatal("separator"))
      ]) {
        equivalent(list(digit, separator), [
          "",
          "1",
          "1,",
          "1,2",
          "1,x",
          "1,2,"
        ])
      }
    }
    for (const p of [
      many(succeed(1)),
      skipMany(succeed(1)),
      sepBy(succeed(1), literal(","))
    ]) {
      expect(() => p.compile().parse(",")).toThrow(/consume input/)
    }
    equivalent(count(succeed(1), 3), [""])
  })

  test("keeps recursive builders lazy and shared with the original parser", () => {
    const builder = vi.fn(
      (self: Parser<unknown>): Parser<unknown> =>
        choice(between(char("("), char(")"), self), literal("a"))
    )
    const p = recursive(builder)
    const fast = p.compile()
    expect(builder).not.toHaveBeenCalled()
    expect(fast.parseOrThrow("((a))")).toBe("a")
    expect(p.parseOrThrow("(a)")).toBe("a")
    expect(builder).toHaveBeenCalledTimes(1)
    equivalent(p, ["", "a", "((a))", "((a)", "(b)"])
  })

  test("does not execute callbacks at compile time or replay them on failure", () => {
    const events: unknown[] = []
    const p = parser(function* () {
      events.push("start")
      try {
        const a = yield* satisfy(function (this: unknown, c) {
          events.push([this, c])
          return c === "a"
        })
        return yield* literal(a).map(function (this: unknown, value) {
          events.push([this, value])
          return value
        })
      } finally {
        events.push("close")
      }
    })
    const fast = p.compile()
    expect(events).toEqual([])
    for (const input of ["aa", "ab", "b", "aa", "b"]) {
      events.length = 0
      p.parse(input)
      const expected = [...events]
      events.length = 0
      fast.parse(input)
      expect(events).toEqual(expected)
    }
  })

  test("closes generators exactly once on thrown callbacks and cleanup errors", () => {
    const error = new Error("callback")
    const cleanup = vi.fn()
    const throwing = literal("a").map(() => {
      throw error
    })
    const p = parser(function* () {
      try {
        return yield* throwing
      } finally {
        cleanup()
      }
    }).compile()
    for (let i = 0; i < 3; i++) expect(() => p.parse("a")).toThrow(error)
    expect(cleanup).toHaveBeenCalledTimes(3)
    const closeError = new Error("cleanup")
    const throwOnClose = () => {
      throw closeError
    }
    const badClose = parser(function* () {
      try {
        yield* fail("no")
      } finally {
        throwOnClose()
      }
    }).compile()
    expect(() => badClose.parse("")).toThrow(closeError)
  })

  test("supports runtime-dependent generators, flatMap, and reentrant parses", () => {
    const p = digit.flatMap(n => count(anyChar(), Number(n)))
    equivalent(p, ["0", "2ab", "3ab", "2👋x"])
    const body = regex(/[a-z]+/)
    const generated = parser(function* () {
      const n = Number(yield* digit)
      const result: string[] = []
      for (let i = 0; i < n; i++) result.push(yield* body.zipLeft(char(";")))
      return result
    })
    equivalent(generated, ["0", "2a;b;", "1x;", "2x;"])
    let fast: Parser<string>
    const reentrant = regex(/[ab]/).map(value =>
      value === "a" ? fast.parseOrThrow("b") + value : value
    )
    fast = reentrant.compile()
    expect(fast.parseOrThrow("a")).toBe("ba")
    expect(fast.parseOrThrow("b")).toBe("b")
  })

  test("bridges advanced runners with their original state and calling convention", () => {
    const custom = makeParser(function (this: unknown, state) {
      expect(this).toBeUndefined()
      return replySuccess(state.offset, State.consume(state, 1))
    })
    equivalent(custom.zip(literal("b")), ["ab", "ax"])
    const contextual = makeParser(state =>
      ParserOutput(
        { ...state, completionContext: ["custom"] },
        { ok: true, value: state }
      )
    )
    equivalent(contextual, ["", "a"])
    const original = State.fromInput("")
    expect(runParser(contextual.compile(), original).result).toEqual({
      ok: true,
      value: original
    })
  })

  test("treats grammar strings as data even when they resemble JavaScript", () => {
    const text = '"); throw new Error("injected"); //\n\u2028\u2029'
    expect(literal(text).compile().parseOrThrow(text)).toBe(text)
    equivalent(regex(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))), [
      text,
      "no"
    ])
  })

  test("code generation is opt-in and a blocked constructor leaves interpretation usable", () => {
    const p = literal("a")
    const blocked = new Error("code generation blocked")
    const spy = vi
      .spyOn(globalThis, "Function")
      .mockImplementation(function () {
        throw blocked
      })
    try {
      expect(p.parseOrThrow("a")).toBe("a")
      expect(() => p.compile()).toThrow(blocked)
    } finally {
      spy.mockRestore()
    }
    expect(p.compile().parseOrThrow("a")).toBe("a")
  })

  test("matches shipped recursive and application grammars on valid and malformed input", () => {
    equivalent(json, [
      '{"ok":[true,null,2,"a\\nb"]}',
      "[1,2,]",
      '{"x":',
      '"unterminated',
      "1 trailing"
    ])
    equivalent(query, [
      "status:open AND (owner:me OR priority >= 3)",
      "status:open AND owner:",
      "status:open OR"
    ])
    equivalent(program, [
      "return /* comment */ value;",
      "1 * 2 + 3;",
      "return\nvalue;",
      "x += 1;"
    ])
    equivalent(expr, ["notable", "not x", "(x +)", "[1;]", "{a = 1;}"])
  })
})
