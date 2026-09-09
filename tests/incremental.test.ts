import { describe, expect, test } from "vitest"
import * as t from "../src/index.ts"
import * as b from "../src/binary/index.ts"
import { takeN } from "../src/combinators.ts"
import {
  makeParser,
  makeResumable,
  replySuccess,
  State,
  isFinal,
  waitForInput
} from "../src/advanced.ts"
import { encode, frame, frames } from "../examples/binary/frames.ts"
import type { CoreParser, IncrementalResult } from "../src/core.ts"

const bytes = (...values: number[]) => Uint8Array.from(values)

/** Compare full-input semantics across every possible partition, including failures. */
function partitions<
  T,
  I extends string | Uint8Array,
  E extends Error & { readonly diagnostic: t.Diagnostic }
>(grammar: CoreParser<T, I, E>, source: I) {
  const complete = grammar.zipLeft(
    (typeof source === "string" ? t.eof : b.eof) as unknown as CoreParser<
      void,
      I,
      E
    >
  )
  const expected = complete.parse(source)
  for (let mask = 0; mask < 2 ** Math.max(0, source.length - 1); mask++) {
    const session = complete.incremental()
    let result: IncrementalResult<T, I, E> = { status: "needMore" }
    let start = 0
    for (let end = 1; end <= source.length; end++) {
      if (end === source.length || mask & (1 << (end - 1))) {
        if (result.status === "needMore")
          result = session.push(source.slice(start, end) as I)
        start = end
      }
    }
    if (result.status === "needMore") result = session.finish()
    if (expected.success) {
      expect(result, `partition ${mask}`).toMatchObject({
        status: "done",
        value: expected.value
      })
    } else {
      expect(result.status, `partition ${mask}`).toBe("error")
      if (result.status === "error") {
        expect(result.error.diagnostic).toEqual(expected.error.diagnostic)
      }
    }
  }
}

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = []
  for await (const value of source) values.push(value)
  return values
}

describe("incremental binary parsing", () => {
  test("suspends inside a generator without replaying earlier reads or callbacks", () => {
    let starts = 0,
      headers = 0,
      closes = 0
    const message = b.parser(function* () {
      starts++
      try {
        const n = yield* b.uint8.map(n => {
          headers++
          return n
        })
        return yield* b.bytes(n)
      } finally {
        closes++
      }
    })
    const session = message.incremental()
    expect(session.push(bytes(3, 10))).toEqual({ status: "needMore" })
    expect(session.push(bytes())).toEqual({ status: "needMore" })
    expect(session.push(bytes(20))).toEqual({ status: "needMore" })
    expect([starts, headers, closes]).toEqual([1, 1, 0])
    expect(session.push(bytes(30, 99))).toEqual({
      status: "done",
      value: bytes(10, 20, 30),
      offset: 4,
      rest: bytes(99)
    })
    expect([starts, headers, closes]).toEqual([1, 1, 1])
    expect(() => session.finish()).toThrow("closed")
  })

  test("full-input parsing waits for finish and rejects extra bytes", () => {
    const session = b.uint8.zipLeft(b.eof).incremental()
    expect(session.push(bytes(1))).toEqual({ status: "needMore" })
    expect(session.finish()).toMatchObject({ status: "done", value: 1 })
    const extra = b.uint8.zipLeft(b.eof).incremental()
    extra.push(bytes(1))
    expect(extra.push(bytes(2))).toMatchObject({ status: "error" })
  })

  test("invalid bytes fail immediately; insufficient bytes fail only at finish", () => {
    expect(b.magic([1, 2]).incremental().push(bytes(9))).toMatchObject({
      status: "error"
    })
    const session = b.uint32BE
      .context("header")
      .incremental({ sourceName: "wire" })
    expect(session.push(bytes(1, 2))).toEqual({ status: "needMore" })
    const result = session.finish()
    expect(result.status).toBe("error")
    if (result.status === "error")
      expect(result.error.format()).toContain("header")
  })

  test("bounded regions finish without waiting for the outer stream", () => {
    const session = b.uint8
      .flatMap(n => b.within(n, b.utf8()))
      .zip(b.uint8)
      .incremental()
    expect(session.push(bytes(2, 0xc3))).toEqual({ status: "needMore" })
    expect(session.push(bytes(0xa9, 7))).toMatchObject({
      status: "done",
      value: ["é", 7]
    })
    const invalid = b.within(1, b.uint16BE).incremental()
    expect(invalid.push(bytes(1))).toMatchObject({ status: "error" })
    partitions(b.within(2, b.uint8), bytes(1, 2))
  })

  test("bit regions, offset reads, scans and input-wide primitives", () => {
    partitions(
      b.bitFields(2, b.bit.uint(12).zip(b.bit.uint(4))),
      bytes(0xab, 0xcd)
    )
    partitions(b.at(2, b.uint16BE).zip(b.bytes(4)), bytes(1, 2, 3, 4))
    partitions(b.at(5, b.uint8), bytes(1, 2, 3))
    partitions(b.cstring, bytes(0xc3, 0xa9, 0))
    partitions(b.cstring, bytes(65, 66))
    partitions(b.takeWhile(n => n < 3).zip(b.rest), bytes(1, 2, 3, 4))
    partitions(b.size.zip(b.rest), bytes(1, 2, 3))
  })

  test("alternatives, backtracking, lookahead and commits survive suspension", () => {
    const long = b.magic([1, 2])
    const short = b.magic([1])
    const session = b.choice(long, short).incremental()
    expect(session.push(bytes(1))).toEqual({ status: "needMore" })
    expect(session.push(bytes(3))).toMatchObject({
      status: "done",
      value: bytes(1),
      rest: bytes(3)
    })
    const committed = b.uint8.commit().zipRight(b.magic([2]))
    for (const source of [bytes(1, 2), bytes(1, 3), bytes(1)]) {
      partitions(b.choice(b.attempt(committed), b.bytes(2)), source)
      partitions(b.choice(committed, b.bytes(2)), source)
      partitions(b.lookahead(long).zipRight(b.bytes(2)), source)
      partitions(b.probe(long).zip(b.rest), source)
      partitions(b.optional(long).zip(b.rest), source)
      partitions(b.notFollowedBy(long).zipRight(b.rest), source)
    }
    partitions(b.many(long), bytes(1, 2, 1, 2))
    partitions(b.many(long), bytes(1, 2, 1))
  })

  test("streams framed messages for every two-way split", async () => {
    const messages = [
      { kind: "ping" },
      { kind: "text", text: "hello" },
      { kind: "point", x: 17, y: 99 }
    ] as const
    const source = encode(messages)
    expect(frames.parseOrThrow(source)).toEqual(messages)
    for (let at = 0; at <= source.length; at++) {
      expect(
        await collect(frame.stream([source.slice(0, at), source.slice(at)]))
      ).toEqual(messages)
    }
    expect(
      await collect(frame.stream(Array.from(source, n => bytes(n))))
    ).toEqual(messages)
    await expect(collect(frame.stream([source.slice(0, -1)]))).rejects.toThrow()
    expect(await collect(frame.stream([]))).toEqual([])
  })

  test("preserves byte values across buffer growth and copies caller chunks", () => {
    const session = b.bytes(1).zip(b.bytes(512)).incremental()
    const first = bytes(7)
    session.push(first)
    first[0] = 99
    const result = session.push(new Uint8Array(512).fill(3))
    expect(result).toMatchObject({
      status: "done",
      value: [bytes(7), new Uint8Array(512).fill(3)]
    })
  })
})

describe("incremental text parsing", () => {
  test("literals and Unicode are independent of UTF-16 chunk boundaries", () => {
    for (const value of ["", "a", "hello", "😀", "a😀b", "\ud800"])
      partitions(t.literal(value), value)
    partitions(t.literal("😀"), "😁")
    partitions(t.literal("x"), "😀")
    partitions(t.char("😀"), "😀")
    partitions(t.many(t.anyChar()), "a😀\ud800b")
    partitions(takeN(2), "😀a")
    partitions(takeN(2), "a")
  })

  test("greedy tokens wait for a boundary; regex waits for finish", () => {
    const session = t
      .takeWhileChar1(c => /[0-9]/.test(c), "digit")
      .map(Number)
      .incremental()
    expect(session.push("12")).toEqual({ status: "needMore" })
    expect(session.push("3;")).toMatchObject({
      status: "done",
      value: 123,
      rest: ";"
    })
    const regex = t.regex(/a(?!bc)/).incremental()
    expect(regex.push("ab")).toEqual({ status: "needMore" })
    expect(regex.push("c")).toEqual({ status: "needMore" })
    expect(regex.finish()).toMatchObject({ status: "error" })
  })

  test("text combinators obey the same partition law", () => {
    partitions(t.oneOfLiterals("a", "abc"), "abc")
    partitions(t.oneOfLiterals("x", "abc"), "abd")
    partitions(t.sepBy(t.literal("ab"), t.char(",")), "ab,ab")
    partitions(t.sepEndBy(t.literal("ab"), t.char(",")), "ab,")
    partitions(t.takeUntil(t.literal("END")).zip(t.literal("!")), "hiEND!")
    partitions(t.takeUpto(t.literal("END")).zip(t.literal("END")), "hiEND")
    partitions(t.takeUntil(t.fail("never")), "😀x")
    partitions(t.count(t.digit, 3), "123")
    partitions(t.struct({ a: t.literal("a"), b: t.literal("bc") }), "abc")
    partitions(
      t.chainLeft1(
        t.digit.map(Number),
        t.char("+").map(() => (a: number, b: number) => a + b)
      ),
      "1+2+3"
    )
    partitions(
      t.chainRight1(
        t.digit.map(Number),
        t.char("^").map(() => (a: number, b: number) => a ** b)
      ),
      "2^2^2"
    )
  })

  test("keyword hints and lexemes resolve boundaries across chunks", async () => {
    const words = ["in", "infix"] as const
    for (const source of ["in", "infix", "inx", "if", "😀"])
      partitions(t.anyKeywordWithHints(words), source)
    partitions(t.stringWithHints(["abc"]), '"abc"')
    partitions(t.stringWithHints(["abc"]), '"abd"')
    const lexemes = t.createLexemes({
      trivia: t.many(t.whitespace),
      identifier: t.takeWhileChar1(c => /[a-z]/.test(c), "letter"),
      keywords: words
    })
    partitions(lexemes.keyword("infix"), "infix ")
    partitions(lexemes.keyword("in"), "infix ")
    partitions(lexemes.complete(lexemes.identifier), "abc ")
    const session = t.anyKeywordWithHints(words).incremental()
    expect(session.push("in")).toEqual({ status: "needMore" })
    expect(session.push("fix;")).toMatchObject({
      status: "done",
      value: "infix",
      rest: ";"
    })
    const record = lexemes.keyword("infix").zipLeft(t.char(";"))
    expect(await collect(record.stream(["in", "fix;infix", ";"]))).toEqual([
      "infix",
      "infix"
    ])
  })

  test("recursive grammars and source positions retain their state", () => {
    const nested = t.recursive<number>(self =>
      t.choice(
        t
          .char("(")
          .zipRight(self)
          .zipLeft(t.char(")"))
          .map(n => n + 1),
        t.char("x").map(() => 0)
      )
    )
    partitions(nested, "((x))")
    partitions(nested, "((x)")
    partitions(
      t.literal("\r").zipRight(t.position).zip(t.literal("\n")),
      "\r\n"
    )
    partitions(
      t.literal("ab").withSpan((value, span) => ({ value, span })),
      "ab"
    )
    partitions(
      t
        .literal("ab")
        .validate(() => "invalid")
        .context("item"),
      "ab"
    )
    partitions(t.skipMany(t.literal("ab")), "abab")
    partitions(
      t.choice(t.char("a").zipRight(t.fatal("fatal")), t.literal("ab")),
      "ab"
    )
  })

  test("streams records, drains alternatives resolved at EOF, and rejects empty matches", async () => {
    const line = t.takeUntil(t.char("\n"))
    expect(await collect(line.stream(["hel", "lo\nw", "orld\n"]))).toEqual([
      "hello",
      "world"
    ])
    expect(
      await collect(t.choice(t.literal("ab"), t.literal("a")).stream(["aa"]))
    ).toEqual(["a", "a"])
    await expect(collect(t.succeed(1).stream(["x"]))).rejects.toThrow(
      "must consume"
    )
  })
})

describe("incremental lifecycle", () => {
  test("cancel closes nested generators once; finish and exceptions clean up", () => {
    const events: string[] = []
    const inner = t.parser(function* () {
      try {
        return yield* t.literal("abc")
      } finally {
        events.push("inner")
      }
    })
    const outer = t.parser(function* () {
      try {
        return yield* inner
      } finally {
        events.push("outer")
      }
    })
    const session = outer.incremental()
    session.push("a")
    session.cancel()
    session.cancel()
    expect(events).toEqual(["inner", "outer"])
    expect(() => session.push("bc")).toThrow("closed")
    const truncated = outer.incremental()
    truncated.push("a")
    expect(truncated.finish()).toMatchObject({ status: "error" })
    expect(events).toEqual(["inner", "outer", "inner", "outer"])
    const throws = outer
      .map(() => {
        throw new Error("callback")
      })
      .incremental()
    throws.push("a")
    expect(() => throws.push("bc")).toThrow("callback")
    expect(() => throws.finish()).toThrow("closed")
  })

  test("independent sessions can interleave", () => {
    const p = b.uint8.zip(b.uint16BE)
    const a = p.incremental(),
      c = p.incremental()
    a.push(bytes(1, 0))
    c.push(bytes(2, 1))
    expect(a.push(bytes(3))).toMatchObject({ status: "done", value: [1, 3] })
    expect(c.push(bytes(4))).toMatchObject({ status: "done", value: [2, 260] })
  })

  test("legacy custom primitives wait for EOF; resumable custom primitives can opt in", () => {
    const legacy = makeParser(state =>
      replySuccess(
        State.remaining(state),
        State.consume(state, state.source.length)
      )
    )
    const session = legacy.incremental()
    expect(session.push("a")).toEqual({ status: "needMore" })
    expect(session.push("b")).toEqual({ status: "needMore" })
    expect(session.finish()).toMatchObject({ status: "done", value: "ab" })
    const custom = makeResumable(function* (state) {
      while (State.isAtEnd(state) && !isFinal(state)) yield* waitForInput(state)
      return replySuccess(State.peek(state), State.consume(state, 1))
    })
    expect(custom.incremental().push("x")).toMatchObject({
      status: "done",
      value: "x"
    })
  })

  test("stream preserves earlier messages before a later failure, and closes on source errors", async () => {
    const output: number[] = []
    await expect(
      (async () => {
        for await (const n of b.uint16BE.stream([bytes(0, 1, 0)]))
          output.push(n)
      })()
    ).rejects.toThrow()
    expect(output).toEqual([1])
    let closed = false
    const grammar = t.parser(function* () {
      try {
        return yield* t.literal("abc")
      } finally {
        closed = true
      }
    })
    async function* broken() {
      yield "a"
      throw new Error("connection")
    }
    await expect(collect(grammar.stream(broken()))).rejects.toThrow(
      "connection"
    )
    expect(closed).toBe(true)
    const large = new Uint8Array(4096).fill(7)
    expect(await collect(b.uint8.stream([large]))).toEqual(Array.from(large))
  })

  test("invalid chunks, reentrancy and invalid custom suspension cannot corrupt a session", () => {
    const session = b.uint16BE.incremental()
    expect(() => session.push("x" as unknown as Uint8Array)).toThrow(TypeError)
    expect(session.push(bytes(0, 3))).toMatchObject({
      status: "done",
      value: 3
    })
    let reentrant: t.IncrementalParser<string>
    reentrant = t
      .char("a")
      .map(value => {
        reentrant.push("b")
        return value
      })
      .incremental()
    expect(() => reentrant.push("a")).toThrow("reentered")
    expect(() => reentrant.finish()).toThrow("closed")
    const invalid = makeResumable(function* (state) {
      yield
      return replySuccess(1, state)
    }).incremental()
    expect(() => invalid.finish()).toThrow("after end-of-input")
    const immediate = makeResumable(state =>
      replySuccess(
        State.remaining(state),
        State.consume(state, state.source.length)
      )
    ).incremental()
    expect(immediate.push("abc")).toMatchObject({
      status: "done",
      value: "abc"
    })
  })

  test("async stream respects backpressure and closes its input on early return", async () => {
    let reads = 0,
      closed = false
    async function* chunks() {
      try {
        reads++
        yield "ab"
        reads++
        yield "c"
      } finally {
        closed = true
      }
    }
    const stream = t.anyChar().stream(chunks())
    expect(await stream.next()).toMatchObject({ value: "a" })
    expect(reads).toBe(1)
    expect(await stream.next()).toMatchObject({ value: "b" })
    expect(reads).toBe(1)
    await stream.return()
    expect(closed).toBe(true)
  })
})
