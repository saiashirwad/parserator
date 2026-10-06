import { describe, expect, test, vi } from "vitest"
import {
  anyChar,
  atLeast,
  attempt,
  char,
  choice,
  commit,
  count,
  createLexemes,
  eof,
  fail,
  fatal,
  keywordWithHints,
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
  regex,
  sepBy,
  sepBy1,
  sepEndBy,
  sepEndBy1,
  skipMany,
  stringWithHints,
  succeed,
  takeUntil,
  takeWhileChar1,
  type Parser
} from "../src/index.ts"
import {
  makeParser,
  replyFailure,
  replySuccess,
  runParser,
  SourceText,
  type Reply
} from "../src/advanced.ts"
import { generateHints, levenshteinDistance } from "../src/diagnostics.ts"

function failure<T>(result: ReturnType<Parser<T>["parse"]>) {
  if (result.success) throw new Error("expected failure")
  return result.error
}

describe("flat runtime replies", () => {
  test("each child gets only source and offset, and reports local cuts", () => {
    const observed: Reply<unknown>[] = []
    const child = makeParser((source, offset) => {
      const reply = runParser(optional(literal("b")), source, offset)
      observed.push(reply)
      return reply
    })
    const source = new SourceText("a")
    expect(
      runParser(commit().zipRight(child).zipRight(literal("a")), source, 0)
    ).toEqual({ ok: true, value: "a", offset: 1, cut: true })
    expect(observed).toEqual([
      { ok: true, value: undefined, offset: 0, cut: false }
    ])
  })

  test("advanced failures preserve offsets independently of deeper diagnostic spans", () => {
    const source = new SourceText("abx")
    const reply = runParser(literal("abc"), source, 0)
    expect(reply).toEqual({
      ok: false,
      offset: 0,
      diagnostic: {
        kind: "expected",
        span: { start: 2, end: 3 },
        expected: ['"abc"'],
        found: "x"
      },
      cut: false,
      fatal: false
    })
    const rich = makeParser((_source, offset) =>
      replyFailure(
        {
          kind: "custom",
          message: "deep issue",
          span: { start: 2, end: 3 },
          hints: ["abc"],
          context: ["token"]
        },
        offset + 1
      )
    )
    expect(runParser(rich.context("grammar"), source, 0)).toMatchObject({
      offset: 1,
      diagnostic: { span: { start: 2, end: 3 }, context: ["token", "grammar"] }
    })
    expect(runParser(choice(rich, literal("abc")), source, 0)).toMatchObject({
      offset: 0,
      diagnostic: { kind: "custom", message: "deep issue" }
    })
  })

  test("literal alternatives merge diagnostics without importing control", () => {
    const source = new SourceText("abz")
    expect(runParser(oneOfLiterals("abc", "abd"), source, 0)).toEqual(
      runParser(choice(literal("abc"), literal("abd")), source, 0)
    )
    const stop = makeParser((_source, offset) =>
      replyFailure(
        {
          kind: "expected",
          expected: ["stop"],
          span: { start: offset, end: offset }
        },
        offset,
        true
      )
    )
    expect(runParser(choice(stop, literal("abc")), source, 0)).toMatchObject({
      cut: true,
      diagnostic: { expected: ["stop"], span: { start: 0, end: 0 } }
    })
  })

  test("recovery examines a failed iteration before earlier successful cuts", () => {
    const source = new SourceText("aa!")
    for (const inner of [
      many(literal("a").commit()),
      skipMany(literal("a").commit())
    ]) {
      expect(runParser<unknown>(inner, source, 0)).toMatchObject({
        ok: true,
        offset: 2,
        cut: true
      })
      expect(
        choice(
          inner.zipRight(fail("after repetition")),
          succeed("fallback")
        ).parsePrefix(source.text).success
      ).toBe(false)
    }
    expect(
      runParser(
        sepEndBy(literal("a").commit(), literal(",")),
        new SourceText("a,"),
        0
      )
    ).toMatchObject({ ok: true, offset: 2, cut: true })
    expect(
      sepEndBy(literal("a"), literal(",").commit()).parse("a,").success
    ).toBe(false)
  })

  test("attempt and speculation isolate ordinary cuts but preserve fatality", () => {
    const source = new SourceText("a")
    const cutFailure = literal("a").commit().zipRight(fail("ordinary"))
    expect(runParser(attempt(cutFailure), source, 0)).toMatchObject({
      ok: false,
      offset: 0,
      cut: false,
      fatal: false
    })
    expect(runParser(attempt(literal("a").commit()), source, 0)).toMatchObject({
      ok: true,
      offset: 1,
      cut: true
    })
    expect(
      runParser(lookahead(literal("a").commit()), source, 0)
    ).toMatchObject({ ok: true, offset: 0, cut: false })
    expect(runParser(lookahead(cutFailure), source, 0)).toMatchObject({
      ok: false,
      offset: 0,
      cut: false
    })
    expect(
      runParser(attempt(commit().zipRight(fatal("broken"))), source, 0)
    ).toMatchObject({ ok: false, cut: false, fatal: true })
    for (const boundary of [
      attempt,
      lookahead,
      probe,
      optional,
      notFollowedBy,
      takeUntil
    ]) {
      const error = failure(boundary(fatal("Fatal: Fatal: broken")).parse("a"))
      expect(error.fatal).toBe(true)
      expect(error.diagnostic.kind).toBe("custom")
      expect(error.message).toBe("Fatal: broken")
      expect(error.format()).toContain("Fatal: broken")
      expect(error.toJSON()).toMatchObject({ kind: "custom", fatal: true })
    }
  })
})

describe("source sessions and progress", () => {
  test("interleaved nested parses own separate lazy position indexes", () => {
    const sessions: SourceText[] = []
    const capture = makeParser((source, offset) => {
      sessions.push(source)
      return replySuccess(source.positionAt(offset), offset)
    })
    const inner = literal("x\r\n").zipRight(capture)
    const outer = literal("😀\n")
      .zipRight(capture)
      .flatMap(value => {
        expect(inner.parseOrThrow("x\r\n")).toEqual({ line: 2, column: 1 })
        return position.map(end => ({ value, end }))
      })
      .zipLeft(capture)
    expect(outer.parseOrThrow("😀\n")).toEqual({
      value: { line: 2, column: 1 },
      end: { offset: 3, line: 2, column: 1 }
    })
    expect(sessions[0]).toBe(sessions[2])
    expect(sessions[0]).not.toBe(sessions[1])
    const bad = capture.zipRight(literal("z")).parse("q")
    expect(failure(bad).source).toBe(sessions[3])
  })

  test("malformed surrogate recognition advances by raw UTF-16 width", () => {
    expect(anyChar().parsePrefix("\ud83dx")).toEqual({
      success: true,
      value: "�",
      offset: 1,
      rest: "x"
    })
    expect(char("�").parsePrefix("\ud83dx")).toEqual({
      success: true,
      value: "�",
      offset: 1,
      rest: "x"
    })
    expect(anyChar().zipRight(position).parseOrThrow("😀")).toEqual({
      line: 1,
      column: 3,
      offset: 2
    })
  })

  test.each([sepBy, sepBy1, sepEndBy, sepEndBy1])(
    "every list rejects its first zero-width item",
    list => {
      expect(() =>
        list(succeed("x"), literal(",")).parsePrefix("no separator")
      ).toThrow("list item must consume input")
      expect(() =>
        list(optional(literal("a")), literal(",")).parse("a,")
      ).toThrow("list item must consume input")
    }
  )

  test("bounded count permits zero width and count zero never invokes the item", () => {
    expect(count(succeed("x"), 3).parseOrThrow("")).toEqual(["x", "x", "x"])
    const invoke = vi.fn(() => {
      throw new Error("must not run")
    })
    expect(count(makeParser(invoke), 0).parseOrThrow("")).toEqual([])
    expect(invoke).not.toHaveBeenCalled()
    for (const repeat of [many, many1, skipMany])
      expect(() => repeat(succeed("x")).parse("")).toThrow(/consume input/)
    expect(() => atLeast(succeed("x"), 0).parse("")).toThrow(/consume input/)
  })

  test("minimum failures retain the actual item diagnostic", () => {
    for (const repeated of [
      many1(literal("abc")),
      atLeast(literal("abc"), 2)
    ]) {
      const error = failure(repeated.parse("abx"))
      expect(error.diagnostic).toMatchObject({
        kind: "expected",
        expected: ['"abc"'],
        span: { start: 2, end: 3 }
      })
    }
    expect(
      failure(atLeast(literal("ab"), 2).parse("abax")).diagnostic.span
    ).toEqual({ start: 3, end: 4 })
    expect(
      failure(takeWhileChar1(c => c === "a", "letter a").parse("b")).diagnostic
    ).toMatchObject({ kind: "expected", expected: ["letter a"] })
  })
})

describe("generator lifecycle", () => {
  test.each([
    "success",
    "ordinary",
    "cut",
    "fatal",
    "callback throw",
    "generator throw"
  ])("finally executes exactly once on %s", path => {
    const cleanup = vi.fn()
    const grammar = parser(function* () {
      try {
        yield* literal("a")
        if (path === "generator throw") throw new TypeError("sentinel")
        if (path === "callback throw")
          yield* succeed(1).map(() => {
            throw new TypeError("sentinel")
          })
        if (path === "cut") yield* commit()
        if (path === "fatal") yield* fatal("fatal")
        if (path === "ordinary" || path === "cut") yield* fail("ordinary")
        return "done"
      } finally {
        cleanup()
      }
    })
    if (path.includes("throw"))
      expect(() => grammar.parse("a")).toThrow("sentinel")
    else expect(grammar.parse("a").success).toBe(path === "success")
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})

describe("lexical completion and suggestions", () => {
  test.each([
    [/[A-Za-z_][A-Za-z0-9_.]*/, "AN.owner"],
    [/[A-Za-z_][A-Za-z0-9_-]*/, "AN-owner"],
    [/\p{L}[\p{L}\p{N}_]*/u, "ANé"]
  ])(
    "uses the same full word for typo spans and identifiers",
    (identifier, word) => {
      const lex = createLexemes({
        trivia: regex(/\s*/),
        identifier,
        keywords: ["AND"] as const
      })
      const error = failure(lex.keyword("AND").parse(word))
      expect(error.diagnostic.found).toBe(word)
      expect(error.diagnostic.span).toEqual({ start: 0, end: word.length })
      expect(lex.identifier.parseOrThrow(word)).toBe(word)
    }
  )

  test("standalone keyword recognition shares Unicode word boundaries", () => {
    const keyword = keywordWithHints(["AND"])("AND")
    for (const word of ["AND.owner", "AND-owner", "ANDé"])
      expect(failure(keyword.parse(word)).diagnostic.found).toBe(word)
  })

  test("conditional empty scanner matches cannot loop", () => {
    const lex = createLexemes({
      trivia: succeed(undefined),
      identifier: /(?=x)/,
      keywords: []
    })
    expect(() => lex.identifier.parse("x")).toThrow(/consume input/)
  })

  test("context only decorates failure and completion owns only trivia plus EOF", () => {
    const lex = createLexemes({
      trivia: regex(/\s*/),
      identifier: /[A-Z]+/,
      keywords: ["AND"]
    })
    expect(
      failure(lex.complete(literal("a").context("inner")).parse("a AND"))
        .diagnostic
    ).toMatchObject({ expected: ["end of input"] })
    expect(
      failure(lex.complete(literal("a").context("inner")).parse("a AND"))
        .diagnostic.context
    ).toBeUndefined()
    expect(
      failure(lex.complete(literal("a")).context("whole").parse("a AND"))
        .diagnostic.context
    ).toEqual(["whole"])
    expect(
      failure(literal("a").context("inner").parse("ab")).diagnostic.context
    ).toBeUndefined()
    expect(literal("a").zipLeft(eof).context("whole").parse("ab").success).toBe(
      false
    )
  })

  test("tied alternatives retain fair deterministic hints and deepest context", () => {
    const diagnostic = (hint: string, context: string[]) =>
      makeParser((_source, offset) =>
        replyFailure(
          {
            kind: "expected",
            expected: [hint],
            span: { start: offset, end: offset + 1 },
            hints: [hint],
            context
          },
          offset
        )
      )
    const grammar = choice(
      diagnostic("alpha", []),
      diagnostic("beta", ["deep"]),
      diagnostic("alpha", [])
    )
    const error = failure(grammar.parse("x"))
    expect(error.diagnostic).toMatchObject({
      expected: ["alpha", "beta"],
      hints: ["alpha", "beta"],
      context: ["deep"]
    })
    expect(error.format()).toContain("Did you mean: alpha, beta?")
    expect(
      error
        .format({ style: "ansi" })
        .replaceAll("\x1b[31m", "")
        .replaceAll("\x1b[0m", "")
    ).toBe(error.format({ style: "plain" }))
    expect(generateHints("AN", ["AND", "ANY", "AN"])).toEqual(["AND", "ANY"])
    expect(levenshteinDistance("AND", "AN")).toBe(1)
  })

  test("quoted hints use recognized contents and span the actual quoted token", () => {
    expect(stringWithHints(["😀"]).parseOrThrow('"😀"')).toBe("😀")
    const error = failure(stringWithHints(["hello"]).parse('"helo"'))
    expect(error.diagnostic).toMatchObject({
      kind: "unexpected",
      found: '"helo"',
      hints: ['"hello"'],
      span: { start: 0, end: 6 }
    })
    expect(
      failure(stringWithHints(["hello"]).parse('"helo')).diagnostic
    ).toMatchObject({
      kind: "expected",
      expected: ["closing quote"],
      span: { start: 5, end: 5 }
    })
    expect(
      failure(stringWithHints(["hello"]).parse('"\ud83d"')).diagnostic.found
    ).toBe('"�"')
  })
})
