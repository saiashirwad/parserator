import { describe, expect, test } from "vitest"
import {
  bit,
  bitFields,
  bytes,
  choice,
  attempt,
  uint8,
  many,
  type BinaryParser,
  type BitOrder
} from "../src/binary/index.ts"

const input = (...values: number[]) => new Uint8Array(values)

function failure<T>(parser: BinaryParser<T>, source: Uint8Array) {
  const result = parser.parse(source)
  if (result.success) throw new Error("Expected a failure")
  return result.error
}

describe("bounded bit fields", () => {
  test("reads flags and then resumes byte parsing", () => {
    const flags = bitFields(
      1,
      bit.parser(function* () {
        const version = yield* bit.uint(3)
        const enabled = yield* bit.uint(1).map(Boolean)
        const kind = yield* bit.uint(4)
        return { version, enabled, kind }
      })
    )
    expect(flags.zip(uint8).parseOrThrow(input(0b10110010, 7))).toEqual([
      { version: 5, enabled: true, kind: 2 },
      7
    ])
  })

  test("bit order controls traversal and significance, across byte boundaries", () => {
    const fields = bit.sequence([bit.uint(4), bit.uint(8), bit.uint(4)])
    expect(bitFields(2, fields).parseOrThrow(input(0xab, 0xcd))).toEqual([
      0xa, 0xbc, 0xd
    ])
    expect(
      bitFields(2, fields, { order: "lsb-first" }).parseOrThrow(
        input(0xab, 0xcd)
      )
    ).toEqual([0xb, 0xda, 0xc])
    expect(
      bitFields(1, bit.sequence([bit.uint(3), bit.uint(5)]), {
        order: "lsb-first"
      }).parseOrThrow(input(0b10110010))
    ).toEqual([2, 22])
  })

  test("number reads stay exact through 53 bits; bigint handles larger fields", () => {
    const source = new Uint8Array(7).fill(255)
    for (const order of ["msb-first", "lsb-first"] as const) {
      expect(
        bitFields(7, bit.uint(53).zipLeft(bit.skip(3)), { order }).parseOrThrow(
          source
        )
      ).toBe(Number.MAX_SAFE_INTEGER)
      expect(
        bitFields(8, bit.bigUint(64), { order }).parseOrThrow(
          new Uint8Array(8).fill(255)
        )
      ).toBe(18446744073709551615n)
    }
  })

  test("rejects unread padding and overreads instead of crossing the boundary", () => {
    expect(
      failure(bitFields(1, bit.uint(3)), input(0)).diagnostic
    ).toMatchObject({
      expected: ["end of bit fields"],
      span: { start: 0, end: 1 },
      bitSpan: { start: 3, end: 4 }
    })
    expect(
      bitFields(1, bit.uint(3).zipLeft(bit.skip(5))).parseOrThrow(input(0xe0))
    ).toBe(7)
    const overread = failure(bitFields(1, bit.uint(9)), input(0, 0xff))
    expect(overread.message).toBe("Expected 9 bits; only 8 bits remain")
    expect(bitFields(2, bit.uint(16)).parse(input(0)).success).toBe(false)
  })

  test("failures identify absolute byte and bit positions after a byte header", () => {
    const parser = bytes(2).zipRight(
      bitFields(1, bit.skip(5).zipRight(bit.fail("bad flags"))).context("flags")
    )
    const error = failure(parser, input(0, 0, 0xff))
    expect(error.toJSON()).toMatchObject({
      unit: "byte",
      span: { start: 2, end: 3 },
      bitSpan: { start: 21, end: 21 },
      context: ["flags"]
    })
    expect(error.format()).toContain("byte 2, bit 5: bad flags")
  })

  test("bit spans are local inside a grammar, byte spans outside the boundary", () => {
    const fields = bit
      .skip(3)
      .zipRight(bit.uint(5).withSpan((value, span) => ({ value, span })))
      .zip(bit.position)
    const parser = uint8.zipRight(
      bitFields(1, fields).withSpan((value, span) => ({ value, span }))
    )
    expect(parser.parseOrThrow(input(0, 0xff))).toEqual({
      value: [{ value: 31, span: { start: 3, end: 8 } }, { offset: 8 }],
      span: { start: 1, end: 2 }
    })
  })

  test("backtracking restores bits; cuts propagate through the byte boundary", () => {
    const fields = bit.choice(
      bit.uint(3).zipRight(bit.fail("try again")),
      bit.uint(8)
    )
    expect(bitFields(1, fields).parseOrThrow(input(0xb2))).toBe(0xb2)
    const committed = bitFields(
      1,
      bit.uint(3).commit().zipRight(bit.fail("bad flags"))
    )
    expect(choice(committed, uint8).parse(input(0xb2)).success).toBe(false)
    expect(choice(attempt(committed), uint8).parseOrThrow(input(0xb2))).toBe(
      0xb2
    )
    expect(many(committed).parse(input(0xb2)).success).toBe(false)
    const successCut = bitFields(1, bit.uint(8).commit()).zipRight(uint8)
    expect(choice(successCut, uint8).parse(input(1)).success).toBe(false)
    const paddingCut = bitFields(1, bit.uint(3).commit())
    expect(choice(paddingCut, uint8).parse(input(1)).success).toBe(false)
    expect(choice(attempt(paddingCut), uint8).parseOrThrow(input(1))).toBe(1)
  })

  test("bit-level attempt, lookahead, fatal errors and repetition retain core semantics", () => {
    const fallback = bit.choice(
      bit.attempt(bit.uint(1).commit().zipRight(bit.fail("no"))),
      bit.uint(8)
    )
    expect(bitFields(1, fallback).parseOrThrow(input(0xff))).toBe(255)
    expect(
      bitFields(1, bit.lookahead(bit.uint(3)).zip(bit.uint(8))).parseOrThrow(
        input(0xff)
      )
    ).toEqual([7, 255])
    expect(
      bitFields(1, bit.many(bit.uint(1))).parseOrThrow(input(0xa0))
    ).toEqual([1, 0, 1, 0, 0, 0, 0, 0])
    expect(() => bitFields(0, bit.many(bit.uint(0))).parse(input())).toThrow(
      "must consume input"
    )
    expect(
      failure(choice(attempt(bitFields(1, bit.fatal("stop"))), uint8), input(1))
        .diagnostic.kind
    ).toBe("fatal")
  })

  test("outer choice compares failures within the same byte precisely", () => {
    const parser = choice(
      bitFields(1, bit.skip(2).zipRight(bit.fail("earlier"))),
      bitFields(1, bit.skip(6).zipRight(bit.fail("later")))
    )
    expect(failure(parser, input(0)).message).toBe("later")
    expect(failure(parser, input(0)).diagnostic.bitSpan).toEqual({
      start: 6,
      end: 6
    })
  })

  test("completion context crosses the boundary and labels preserve bit locations", () => {
    const parser = bitFields(1, bit.uint(8).context("flags"))
    expect(failure(parser, input(0, 0)).diagnostic.context).toEqual(["flags"])
    const padding = bitFields(1, bit.uint(3).context("flags"))
    expect(failure(padding, input(0)).diagnostic.context).toEqual(["flags"])
    const labeled = bitFields(
      1,
      bit.skip(3).zipRight(bit.fail("bad"))
    ).expected("flags")
    expect(failure(labeled, input(0)).diagnostic).toMatchObject({
      expected: ["flags"],
      bitSpan: { start: 3, end: 3 }
    })
  })

  test("successful bit fields preserve outer context unless the inner parser supplies it", () => {
    const header = uint8.context("header")
    const plain = header.zipRight(bitFields(1, bit.uint(8)))
    expect(failure(plain, input(1, 2, 3)).diagnostic).toMatchObject({
      context: ["header"],
      span: { start: 2, end: 3 }
    })

    const contextual = header.zipRight(
      bitFields(1, bit.uint(8).context("flags"))
    )
    expect(failure(contextual, input(1, 2, 3)).diagnostic.context).toEqual([
      "flags"
    ])
  })

  test("standalone bit prefix parsing preserves an unaligned remainder", () => {
    const result = bit
      .uint(3)
      .parsePrefix({ bytes: input(0xb2), order: "msb-first" })
    expect(result.success).toBe(true)
    if (!result.success) throw result.error
    expect(result.value.offset).toBe(3)
    expect(result.value.value).toBe(5)
    expect(bit.uint(5).parseOrThrow(result.value.rest)).toBe(18)
  })

  test("checks counts, precision, bit order, and empty fields", () => {
    for (const n of [-1, 1.5, Infinity, NaN]) {
      expect(() => bit.uint(n)).toThrow(RangeError)
      expect(() => bit.bigUint(n)).toThrow(RangeError)
      expect(() => bit.skip(n)).toThrow(RangeError)
      expect(() => bitFields(n, bit.uint(0))).toThrow(RangeError)
    }
    expect(() => bit.uint(54)).toThrow("at most 53")
    expect(() => bitFields(Number.MAX_SAFE_INTEGER, bit.uint(0))).toThrow(
      RangeError
    )
    expect(() =>
      bitFields(1, bit.uint(8), { order: "invalid" as BitOrder })
    ).toThrow(TypeError)
    expect(bitFields(0, bit.uint(0)).parseOrThrow(input())).toBe(0)
    expect(bitFields(0, bit.bigUint(0)).parseOrThrow(input())).toBe(0n)
    expect(bitFields(1, bit.bigUint(9)).parse(input(0)).success).toBe(false)
  })
})
