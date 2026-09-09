import { Buffer } from "node:buffer"
import { describe, expect, test } from "vitest"
import * as b from "../src/binary/index.ts"
import { literal } from "../src/index.ts"

const input = (...values: number[]) => new Uint8Array(values)

function error(
  parser: b.BinaryParser<unknown>,
  source: Uint8Array
): b.BinaryParseError {
  const result = parser.parse(source, { sourceName: "packet.bin" })
  if (result.success) throw new Error("Expected a parse failure")
  return result.error
}

const packet = b.parser(function* () {
  yield* b.magic([0xca, 0xfe])
  const version = yield* b.uint8
  const length = yield* b.uint16BE
  const payload = yield* b.bytes(length).context("payload")
  return { version, payload }
})

describe("hex", () => {
  test("decodes pairs, ignoring whitespace and case", () => {
    expect(b.hex("ca fe\n01")).toEqual(input(0xca, 0xfe, 0x01))
    expect(b.hex("CAFE")).toEqual(input(0xca, 0xfe))
    expect(b.hex("")).toEqual(input())
  })

  test("rejects odd digit counts and non-hex characters", () => {
    expect(() => b.hex("abc")).toThrow("pairs of hex digits")
    expect(() => b.hex("zz")).toThrow('"zz"')
  })
})

describe("binary input and byte primitives", () => {
  test("parses a length-prefixed packet and rejects every truncation", () => {
    const source = input(0xca, 0xfe, 1, 0, 3, 0x10, 0x20, 0x30)
    expect(packet.parseOrThrow(source)).toEqual({
      version: 1,
      payload: input(0x10, 0x20, 0x30)
    })
    for (let length = 0; length < source.length; length++) {
      expect(packet.parse(source.subarray(0, length)).success).toBe(false)
    }
  })

  test("parse requires complete input; parsePrefix returns an input view", () => {
    const source = input(3, 4, 5)
    expect(b.uint8.parse(source).success).toBe(false)
    const result = b.uint8.parsePrefix(source)
    expect(result).toEqual({
      success: true,
      value: { value: 3, offset: 1, rest: input(4, 5) }
    })
    if (!result.success) throw result.error
    expect(result.value.rest.buffer).toBe(source.buffer)
    expect(b.uint16BE.parseOrThrow(result.value.rest)).toBe(0x0405)
  })

  test("bytes returns a shared view and supports an explicit copy", () => {
    const source = input(1, 2, 3)
    const value = b.uint8.zipRight(b.bytes(2)).parseOrThrow(source)
    const copy = b
      .bytes(3)
      .map(bytes => bytes.slice())
      .parseOrThrow(source)
    expect(value.byteOffset).toBe(source.byteOffset + 1)
    source[1] = 9
    expect(value).toEqual(input(9, 3))
    expect(copy).toEqual(input(1, 2, 3))
  })

  test("supports empty input and zero-width byte reads", () => {
    expect(b.bytes(0).parseOrThrow(input())).toEqual(input())
    expect(b.magic([]).parseOrThrow(input())).toEqual(input())
    expect(b.eof.parseOrThrow(input())).toBeUndefined()
    expect(b.bytes(Number.MAX_SAFE_INTEGER).parse(input()).success).toBe(false)
  })

  test("magic snapshots its signature and locates the first mismatch", () => {
    const signature = [0xca, 0xfe]
    const parser = b.magic(signature)
    signature[0] = 0
    expect(parser.parseOrThrow(input(0xca, 0xfe))).toEqual(input(0xca, 0xfe))
    expect(error(parser, input(0xca, 0)).diagnostic).toMatchObject({
      span: { start: 1, end: 2 },
      expected: ["[ca fe]"],
      found: "0x00"
    })
    expect(error(parser, input(0xca)).diagnostic).toMatchObject({
      span: { start: 1, end: 1 },
      found: "end of input"
    })
  })

  test("rejects invalid construction arguments and input kinds", () => {
    for (const n of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => b.bytes(n)).toThrow(RangeError)
      expect(() => b.count(b.uint8, n)).toThrow(RangeError)
    }
    for (const value of [-1, 256, 1.5, NaN, Infinity]) {
      expect(() => b.magic([value])).toThrow(RangeError)
    }
    for (const value of [
      "abc",
      [1],
      new Uint16Array([1]),
      new ArrayBuffer(1)
    ]) {
      expect(() => b.uint8.parse(value as unknown as Uint8Array)).toThrow(
        TypeError
      )
    }
    expect(() =>
      literal("x")
        .zip(b.uint8 as never)
        .parse("x")
    ).toThrow("Not a Parser")
    expect(() => b.uint8.zip(literal("x") as never).parse(input(1))).toThrow(
      "Not a Parser"
    )
  })
})

const numbers = [
  ["uint8", b.uint8, [0xff], 255],
  ["uint16BE", b.uint16BE, [0x12, 0x34], 0x1234],
  ["uint16LE", b.uint16LE, [0x12, 0x34], 0x3412],
  ["uint32BE", b.uint32BE, [0x89, 0xab, 0xcd, 0xef], 0x89abcdef],
  ["uint32LE", b.uint32LE, [0x89, 0xab, 0xcd, 0xef], 0xefcdab89],
  ["uint64BE", b.uint64BE, [1, 2, 3, 4, 5, 6, 7, 8], 0x0102030405060708n],
  ["uint64LE", b.uint64LE, [1, 2, 3, 4, 5, 6, 7, 8], 0x0807060504030201n]
] as const

describe("regions", () => {
  test("size and rest see the input, or the enclosing within region", () => {
    expect(b.size.zip(b.rest).parseOrThrow(input(1, 2, 3))).toEqual([
      3,
      input(1, 2, 3)
    ])
    const bounded = b.uint8.zipRight(b.within(1, b.size.zipLeft(b.rest)))
    expect(bounded.parseOrThrow(input(0, 0))).toBe(2)
    expect(b.rest.parseOrThrow(input())).toEqual(input())
    const region = b.uint8.zip(b.within(2, b.rest)).zip(b.rest)
    expect(region.parseOrThrow(input(9, 1, 2, 3))).toEqual([
      [9, input(1, 2)],
      input(3)
    ])
  })

  test("within bounds eof, requires full consumption, and keeps absolute offsets", () => {
    const pair = b.uint8.zip(b.uint8).zipLeft(b.eof)
    const framed = b.uint8.zipRight(b.within(2, pair))
    expect(framed.parseOrThrow(input(0, 5, 6))).toEqual([5, 6])

    const short = error(framed, input(0, 5))
    expect(short.message).toBe("Expected 2 bytes; only 1 bytes remain")
    expect(short.diagnostic.span).toEqual({ start: 1, end: 2 })

    const truncatedInside = error(
      b.uint8.zipRight(b.within(1, pair)),
      input(0, 5, 6)
    )
    expect(truncatedInside.message).toBe(
      "Expected uint8 (1 byte); only 0 bytes remain"
    )
    expect(truncatedInside.diagnostic.span).toEqual({ start: 2, end: 2 })

    const unconsumed = error(
      b.uint8.zipRight(b.within(3, b.uint8)),
      input(0, 5, 6, 7)
    )
    expect(unconsumed.message).toBe("Unconsumed bytes: 2 of 3")
    expect(unconsumed.diagnostic).toMatchObject({
      span: { start: 2, end: 3 },
      expected: ["end of 3 bytes"],
      found: "0x06"
    })
    expect(unconsumed.format()).toContain("packet.bin: byte 2")
  })

  test("within propagates commits and fatal failures", () => {
    const committed = b.within(2, b.uint8.commit().zipRight(b.fail("no")))
    expect(b.choice(committed, b.succeed(0)).parse(input(1, 2)).success).toBe(
      false
    )
    const fatal = b.within(1, b.fatal("stop"))
    expect(b.optional(fatal).parse(input(1)).success).toBe(false)
    expect(() => b.within(-1, b.uint8)).toThrow(RangeError)
  })
})

describe("signed, floating point, and runtime byte order", () => {
  test("signed integers use two's complement in both orders", () => {
    expect(b.int8.parseOrThrow(input(0xff))).toBe(-1)
    expect(b.int8.parseOrThrow(input(0x7f))).toBe(127)
    expect(b.int16BE.parseOrThrow(input(0x80, 0x00))).toBe(-32768)
    expect(b.int16LE.parseOrThrow(input(0xfe, 0xff))).toBe(-2)
    expect(b.int32BE.parseOrThrow(input(0x7f, 0xff, 0xff, 0xff))).toBe(
      2147483647
    )
    expect(b.int32LE.parseOrThrow(input(0xff, 0xff, 0xff, 0xff))).toBe(-1)
    const allOnes = input(...Array<number>(8).fill(0xff))
    expect(b.int64BE.parseOrThrow(allOnes)).toBe(-1n)
    expect(b.int64LE.parseOrThrow(allOnes)).toBe(-1n)
    expect(b.uint64BE.parseOrThrow(allOnes)).toBe(2n ** 64n - 1n)
  })

  test("floats decode through a view that respects the input's byte offset", () => {
    expect(b.float32BE.parseOrThrow(input(0x3f, 0x80, 0, 0))).toBe(1)
    expect(b.float32LE.parseOrThrow(input(0, 0, 0x80, 0x3f))).toBe(1)
    expect(b.float64LE.parseOrThrow(input(0, 0, 0, 0, 0, 0, 0xf8, 0x3f))).toBe(
      1.5
    )
    const padded = input(0xaa, 0xbb, 0x3f, 0xf8, 0, 0, 0, 0, 0, 0)
    expect(b.float64BE.parseOrThrow(padded.subarray(2))).toBe(1.5)
    expect(
      b.uint8.zipRight(b.float32BE).parseOrThrow(input(7, 0x3f, 0x80, 0, 0))
    ).toBe(1)
  })

  test("numbers(order) exposes the same readers for one byte order", () => {
    const { uint16, int32, float64 } = b.numbers("LE")
    expect(uint16.parseOrThrow(input(0x34, 0x12))).toBe(0x1234)
    expect(int32.parseOrThrow(input(0xff, 0xff, 0xff, 0xff))).toBe(-1)
    expect(float64.parseOrThrow(input(0, 0, 0, 0, 0, 0, 0xf8, 0x3f))).toBe(1.5)
    expect(error(b.numbers("BE").int16, input(1)).message).toBe(
      "Expected int16BE (2 bytes); only 1 bytes remain"
    )
  })
})

describe("byte runs and strings", () => {
  test("skip discards bytes and reports short input", () => {
    expect(
      b
        .skip(2)
        .zipRight(b.uint8)
        .parseOrThrow(input(1, 2, 3))
    ).toBe(3)
    expect(error(b.skip(3), input(1)).message).toBe(
      "Expected 3 bytes to skip; only 1 bytes remain"
    )
  })

  test("takeWhile and bytesUntil return shared views", () => {
    const digits = b.takeWhile(byte => byte >= 0x30 && byte <= 0x39)
    const source = input(0x31, 0x32, 0x41)
    const [run, next] = digits.zip(b.uint8).parseOrThrow(source)
    expect(run).toEqual(input(0x31, 0x32))
    expect(run.buffer).toBe(source.buffer)
    expect(next).toBe(0x41)
    expect(digits.parsePrefix(input(0x41))).toMatchObject({
      success: true,
      value: { value: input(), offset: 0 }
    })

    const line = b.bytesUntil(0x0a).zipLeft(b.skip(1))
    expect(line.parseOrThrow(input(0x68, 0x69, 0x0a))).toEqual(
      input(0x68, 0x69)
    )
    const missing = error(b.bytesUntil(0x0a), input(0x68, 0x69))
    expect(missing.message).toBe(
      "Expected 0x0a before the end of input, found end of input"
    )
    expect(missing.diagnostic.span).toEqual({ start: 0, end: 2 })
    expect(() => b.bytesUntil(256)).toThrow(RangeError)
  })

  test("ascii decodes large inputs without exceeding the argument limit", () => {
    const source = new Uint8Array(500_000).fill(0x41)
    const expected = "A".repeat(source.length)
    expect(b.ascii().parseOrThrow(source)).toBe(expected)
    expect(b.ascii(source.length).parseOrThrow(source)).toBe(expected)
  })

  test("ascii, utf8, and cstring decode and reject bad bytes", () => {
    expect(b.ascii(4).parseOrThrow(input(0x49, 0x48, 0x44, 0x52))).toBe("IHDR")
    expect(error(b.ascii(2), input(0x49, 0xc3)).message).toBe(
      "Expected 2 ASCII bytes"
    )
    expect(b.utf8(3).parseOrThrow(input(0xe2, 0x82, 0xac))).toBe("€")
    expect(b.utf8().parseOrThrow(input(0xe2, 0x82, 0xac, 0x21))).toBe("€!")
    expect(
      b
        .within(2, b.ascii())
        .zipLeft(b.rest)
        .parseOrThrow(input(0x68, 0x69, 0))
    ).toBe("hi")
    expect(error(b.ascii(), input(0xc3)).message).toBe("Expected ASCII text")
    expect(error(b.utf8(2), input(0xe2, 0x82)).message).toBe(
      "Expected valid UTF-8"
    )
    const pair = b.cstring.zip(b.cstring)
    expect(pair.parseOrThrow(input(0x68, 0x69, 0, 0xc3, 0xa9, 0))).toEqual([
      "hi",
      "é"
    ])
    expect(error(b.cstring, input(0x68, 0x69)).message).toBe(
      "Expected NUL-terminated string, found end of input"
    )
  })
})

describe("absolute positioning", () => {
  test("at parses at an offset and returns to the current position", () => {
    const table = b.parser(function* () {
      const offset = yield* b.uint8
      const name = yield* b.at(offset, b.cstring)
      const next = yield* b.uint8
      yield* b.rest
      return { name, next }
    })
    expect(table.parseOrThrow(input(2, 9, 0x6f, 0x6b, 0))).toEqual({
      name: "ok",
      next: 9
    })
  })

  test("at reports failures at their true offset and rejects offsets past the end", () => {
    const inside = error(b.at(2, b.uint16BE), input(0, 0, 5))
    expect(inside.message).toBe(
      "Expected uint16BE (2 bytes); only 1 bytes remain"
    )
    expect(inside.diagnostic.span).toEqual({ start: 2, end: 3 })
    expect(b.at(3, b.eof).parsePrefix(input(0, 0, 0)).success).toBe(true)
    const past = error(b.at(4, b.uint8), input(0, 0, 0))
    expect(past.message).toBe("Offset 4 is past the end of the 3-byte input")
    expect(() => b.at(-1, b.uint8)).toThrow(RangeError)
  })

  test("at inside within stays inside the region", () => {
    const region = b.within(2, b.at(1, b.uint8).zipLeft(b.rest))
    expect(region.parseOrThrow(input(7, 8, 9).subarray(0, 2))).toBe(8)
    const outside = b.within(2, b.at(2, b.uint8).zipLeft(b.rest))
    expect(error(outside, input(7, 8, 9)).message).toBe(
      "Expected uint8 (1 byte); only 0 bytes remain"
    )
  })
})

describe("numeric readers", () => {
  for (const [name, parser, values, expected] of numbers) {
    test(`${name}: endian, sliced input, Buffer, and all truncations`, () => {
      const source = input(0, ...values, 0)
      expect(parser.parseOrThrow(source.subarray(1, -1))).toBe(expected)
      expect(parser.parseOrThrow(Buffer.from(source).subarray(1, -1))).toBe(
        expected
      )
      // Both the supplied view offset and the parser cursor are nonzero.
      expect(
        b.uint8
          .zipRight<number | bigint>(parser)
          .parseOrThrow(input(9, 8, ...values).subarray(1))
      ).toBe(expected)
      for (let length = 0; length < values.length; length++) {
        const view = source.subarray(1, length + 1)
        const result = parser.parse(view)
        expect(result.success).toBe(false)
        if (!result.success)
          expect(result.error).toBeInstanceOf(b.BinaryParseError)
      }
    })
  }

  test("unsigned 64-bit values are lossless", () => {
    expect(b.uint64BE.parseOrThrow(new Uint8Array(8).fill(255))).toBe(
      18446744073709551615n
    )
    expect(b.uint64LE.parseOrThrow(new Uint8Array(8).fill(255))).toBe(
      18446744073709551615n
    )
  })
})

describe("binary combinator semantics", () => {
  const oneTwo = b.uint8.validate(n => n === 1).zipRight(b.magic([2]))

  test("choice restores consumed input; commits stop alternatives; attempt restores recovery", () => {
    expect(b.choice(oneTwo, b.bytes(2)).parseOrThrow(input(1, 3))).toEqual(
      input(1, 3)
    )
    const committed = b
      .magic([1])
      .commit()
      .zipRight(b.magic([2]))
    expect(b.choice(committed, b.bytes(2)).parse(input(1, 3)).success).toBe(
      false
    )
    expect(
      b.choice(b.attempt(committed), b.bytes(2)).parseOrThrow(input(1, 3))
    ).toEqual(input(1, 3))
  })

  test("fatal failures survive choice, attempt, probes, and optional", () => {
    const fatal = b.uint8.zipRight(b.fatal("bad packet"))
    for (const parser of [
      b.choice(fatal, b.bytes(1)),
      b.attempt(fatal),
      b.lookahead(fatal),
      b.probe(fatal),
      b.notFollowedBy(fatal),
      b.optional(fatal),
      b.many(fatal)
    ]) {
      expect(error(parser, input(1)).diagnostic.kind).toBe("fatal")
    }
  })

  test("lookahead and probes leave bytes and speculative commits untouched", () => {
    expect(
      b.lookahead(b.uint8.commit()).zip(b.uint8).parseOrThrow(input(8))
    ).toEqual([8, 8])
    expect(b.probe(oneTwo).zip(b.bytes(2)).parseOrThrow(input(1, 3))).toEqual([
      undefined,
      input(1, 3)
    ])
    expect(
      b
        .notFollowedBy(b.magic([9]))
        .zipRight(b.uint8)
        .parseOrThrow(input(8))
    ).toBe(8)
    expect(b.notFollowedBy(b.magic([8])).parse(input(8)).success).toBe(false)
    expect(
      b
        .choice(b.lookahead(b.uint8.commit().zipRight(b.fail("no"))), b.uint8)
        .parseOrThrow(input(8))
    ).toBe(8)
  })

  test("optional and many recover consumption but preserve committed failures", () => {
    expect(
      b.optional(oneTwo).zipRight(b.bytes(2)).parseOrThrow(input(1, 3))
    ).toEqual(input(1, 3))
    expect(
      b
        .many(oneTwo)
        .zip(b.bytes(2))
        .parseOrThrow(input(1, 2, 1, 3))
    ).toEqual([[input(2)], input(1, 3)])
    const item = b
      .magic([1])
      .commit()
      .zipRight(b.magic([2]))
    expect(b.optional(item).parse(input(1, 3)).success).toBe(false)
    expect(b.many(item).parse(input(1, 2, 1, 3)).success).toBe(false)
    expect(b.many(b.uint8).parseOrThrow(input(1, 2, 3))).toEqual([1, 2, 3])
    expect(b.many1(b.uint8).parse(input()).success).toBe(false)
    expect(b.count(b.uint16BE, 2).parseOrThrow(input(0, 1, 0, 2))).toEqual([
      1, 2
    ])
    expect(b.skipMany(b.uint8).parseOrThrow(input(1, 2))).toBeUndefined()
  })

  test("repetition rejects zero-width success", () => {
    expect(() => b.many(b.bytes(0)).parse(input())).toThrow(
      "must consume input"
    )
    expect(() => b.skipMany(b.succeed(1)).parse(input())).toThrow(
      "must consume input"
    )
  })

  test("recursive binary generators and cleanup use the shared engine", () => {
    const nested: b.BinaryParser<number> = b.recursive(self =>
      b.parser(function* () {
        const tag = yield* b.uint8
        return tag === 0 ? 0 : (yield* self) + 1
      })
    )
    expect(nested.parseOrThrow(input(1, 1, 0))).toBe(2)
    let closed = 0
    const parser = b.parser(function* () {
      try {
        return yield* b.uint16BE
      } finally {
        closed++
      }
    })
    expect(parser.parse(input(1)).success).toBe(false)
    expect(closed).toBe(1)
  })

  test("sequences, separated lists, and byte spans retain their types and positions", () => {
    expect(
      b.sequence([b.uint8, b.uint16LE]).parseOrThrow(input(1, 2, 3))
    ).toEqual([1, 0x0302])
    const item = b.uint8.validate(n => n !== 0)
    expect(b.sepBy(item, b.magic([0])).parseOrThrow(input(1, 0, 2))).toEqual([
      1, 2
    ])
    expect(b.sepEndBy(item, b.magic([0])).parseOrThrow(input(1, 0))).toEqual([
      1
    ])
    const parser = b.uint8
      .zipRight(b.bytes(2).withSpan((value, span) => ({ value, span })))
      .zip(b.position)
    expect(parser.parseOrThrow(input(1, 2, 3))).toEqual([
      { value: input(2, 3), span: { start: 1, end: 3 } },
      { offset: 3 }
    ])
  })
})

describe("binary diagnostics", () => {
  test("formats byte positions and hex context with a stable JSON unit", () => {
    const failure = error(
      b.uint8.zipRight(b.uint32BE.context("payload")),
      input(9, 0xaa, 0xbb)
    )
    expect(failure).toBeInstanceOf(Error)
    expect(failure.diagnostic).toMatchObject({
      span: { start: 1, end: 3 },
      context: ["payload"]
    })
    expect(failure.format()).toBe(
      "packet.bin: byte 1: Expected uint32BE (4 bytes); only 2 bytes remain\n" +
        "00000000  09 aa bb\n" +
        "             ^^^^^\nwhile parsing payload"
    )
    expect(failure.toJSON()).toMatchObject({
      unit: "byte",
      sourceName: "packet.bin",
      span: { start: 1, end: 3 }
    })
    expect(() => b.uint32BE.parseOrThrow(input())).toThrow(b.BinaryParseError)
  })

  test("shows every checksum byte when its span crosses a hex row", () => {
    const source = new Uint8Array(19)
    source.set([0x56, 0x02, 0xcb, 0x66], 15)
    const failure = error(
      b.bytes(15).zipRight(b.uint32BE.validate(() => "CRC mismatch")),
      source
    )
    expect(failure.format()).toBe(
      "packet.bin: byte 15: CRC mismatch\n" +
        "00000000  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 56\n" +
        " ".repeat(55) +
        "^^\n" +
        "00000010  02 cb 66\n" +
        "          ^^^^^^^^"
    )
  })

  test("a span ending on a row boundary does not add an empty row", () => {
    const failure = error(
      b.bytes(16).validate(() => "invalid block"),
      new Uint8Array(16)
    )
    expect(failure.format().split("\n")).toHaveLength(3)
    expect(failure.format()).not.toContain("00000010")
  })

  test("large validation spans show both ends in a bounded excerpt", () => {
    const failure = error(
      b.rest.validate(() => "invalid payload"),
      new Uint8Array(1024 * 1024)
    )
    const lines = failure.format().split("\n")
    expect(lines).toHaveLength(10)
    expect(lines[1]).toMatch(/^00000000 /)
    expect(lines[3]).toMatch(/^00000010 /)
    expect(lines[5]).toBe("...")
    expect(lines[6]).toMatch(/^000fffe0 /)
    expect(lines[8]).toMatch(/^000ffff0 /)
  })

  test("EOF, completion context, and label overrides remain structured", () => {
    const failure = error(b.uint8.context("header"), input(1, 2))
    expect(failure.diagnostic).toMatchObject({
      expected: ["end of input"],
      context: ["header"],
      span: { start: 1, end: 2 }
    })
    expect(
      error(b.uint8.expected("version"), input()).diagnostic
    ).toMatchObject({ expected: ["version"], span: { start: 0, end: 0 } })
    expect(error(b.uint8, input()).format()).toContain("byte 0")
    expect(
      error(b.bytes(16).zipRight(b.uint8), new Uint8Array(16)).format()
    ).toContain("00000010")
  })

  test("choice selects the furthest failure and merges expectations", () => {
    const failure = error(
      b.choice(b.magic([1, 2]), b.magic([1, 3])),
      input(1, 4)
    )
    expect(failure.diagnostic).toMatchObject({
      span: { start: 1, end: 2 },
      expected: ["[01 02]", "[01 03]"]
    })
    const furthest = error(
      b.choice(b.magic([0]), b.magic([1, 2, 3])),
      input(1, 2)
    )
    expect(furthest.diagnostic.span).toEqual({ start: 2, end: 2 })
  })
})
