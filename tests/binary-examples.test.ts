import { describe, expect, test } from "vitest"
import {
  hex,
  type BinaryParseError,
  type BinaryParseResult,
  type BinaryParser
} from "../src/binary/index.ts"
import { elf } from "../examples/binary/elf.ts"
import { tinyElf, tinyPng, tinyZip } from "../examples/binary/fixtures.ts"
import { encode, frame, frames, varint } from "../examples/binary/frames.ts"
import { ipv4Header } from "../examples/binary/ipv4.ts"
import { crc32, png } from "../examples/binary/png.ts"
import { wavFormat } from "../examples/binary/wav.ts"
import { zip } from "../examples/binary/zip.ts"

function prefix<T>(parser: BinaryParser<T>, input: Uint8Array): T {
  const result = parser.parsePrefix(input)
  if (!result.success) throw result.error
  return result.value.value
}

function failure(result: BinaryParseResult<unknown>): BinaryParseError {
  if (result.success) throw new Error("Expected a parse failure")
  return result.error
}

describe("binary examples", () => {
  test("wavFormat reads the fmt chunk and leaves the samples", () => {
    const header = hex(
      "52 49 46 46 24 08 00 00 57 41 56 45 66 6d 74 20 12 00 00 00" +
        "01 00 02 00 44 ac 00 00 10 b1 02 00 04 00 10 00 00 00 64 61 74 61"
    )
    const result = wavFormat.parsePrefix(header)
    if (!result.success) throw result.error
    expect(result.value.value).toEqual({
      audioFormat: 1,
      channels: 2,
      sampleRate: 44100,
      byteRate: 176400,
      blockAlign: 4,
      bitsPerSample: 16
    })
    expect(result.value.rest).toEqual(hex("64 61 74 61"))

    const aiff = failure(wavFormat.parse(hex("46 4f 52 4d 00 00 08 24")))
    expect(aiff.message).toBe('Expected "RIFF", found 0x46')
  })

  test("crc32 matches the reference value used by PNG", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926)
  })

  test("png reads a 1x1 image and rejects a corrupted chunk", () => {
    const image = png.parseOrThrow(tinyPng)
    expect(image.header).toEqual({
      width: 1,
      height: 1,
      bitDepth: 8,
      colorType: 6,
      compression: 0,
      filter: 0,
      interlace: 0
    })
    expect(image.chunks.map(c => c.type)).toEqual(["IDAT"])

    const corrupt = tinyPng.slice()
    corrupt[45] = corrupt[45]! ^ 0xff
    const error = failure(png.parse(corrupt, { sourceName: "corrupt.png" }))
    expect(error.message).toMatch(
      /^IDAT CRC mismatch: expected 0x[0-9a-f]{8}, found 0x[0-9a-f]{8}$/
    )
    expect(error.format()).toContain("corrupt.png: byte 54")
    expect(error.format()).toContain("while parsing PNG > IDAT > checksum")

    const iend = new TextEncoder().encode("IEND")
    const payload = Uint8Array.from([...iend, 0x00])
    const crc = crc32(payload)
    const nonEmptyEnd = Uint8Array.from([
      ...tinyPng.subarray(0, tinyPng.length - 12),
      0,
      0,
      0,
      1,
      ...payload,
      crc >>> 24,
      (crc >>> 16) & 0xff,
      (crc >>> 8) & 0xff,
      crc & 0xff
    ])
    expect(failure(png.parse(nonEmptyEnd)).message).toBe(
      "IEND chunk must be empty"
    )

    expect(failure(png.parse(hex("89 50 4e 47 00"))).message).toBe(
      "Expected PNG signature, found 0x00"
    )
  })

  test("ipv4Header decodes bit fields, addresses, and IHL-sized options", () => {
    const header = ipv4Header.parseOrThrow(
      hex("45 00 00 3c 1c 46 40 00 40 06 b1 e6 ac 10 0a 63 ac 10 0a 0c")
    )
    expect(header).toMatchObject({
      headerLength: 20,
      totalLength: 60,
      identification: 0x1c46,
      flags: { dontFragment: true, moreFragments: false },
      fragmentOffset: 0,
      ttl: 64,
      protocol: 6,
      source: "172.16.10.99",
      destination: "172.16.10.12"
    })
    expect(header.options).toHaveLength(0)

    const withOptions = ipv4Header.parseOrThrow(
      hex(
        "46 00 00 3c 1c 46 40 00 40 06 b1 e6 ac 10 0a 63 ac 10 0a 0c 01 01 01 01"
      )
    )
    expect(withOptions.options).toEqual(hex("01 01 01 01"))

    const ipv6 = failure(ipv4Header.parse(hex("60 00 00 00 00 00 00 00")))
    expect(ipv6.message).toBe("IP version must be 4")
    expect(ipv6.format()).toContain("byte 0, bit 0")
  })

  test("varint reads LEB128 and frames round-trip through encode", () => {
    expect(varint.parseOrThrow(hex("e5 8e 26"))).toBe(624485)
    expect(varint.parseOrThrow(hex("ff ff ff ff ff ff ff 0f"))).toBe(
      Number.MAX_SAFE_INTEGER
    )
    expect(failure(varint.parse(hex("80 80 80 80 80 80 80 10"))).message).toBe(
      "varint does not fit in a number"
    )
    const items = [
      { kind: "ping" as const },
      { kind: "text" as const, text: "héllo" },
      { kind: "point" as const, x: 640, y: 480 }
    ]
    expect(frames.parseOrThrow(encode(items))).toEqual(items)

    const badTag = failure(frames.parse(hex("01 00 09 00")))
    expect(badTag.message).toBe("unknown frame tag 9")
    expect(badTag.diagnostic.span).toEqual({ start: 2, end: 3 })

    const short = failure(frame.parse(hex("03 04 02 80")))
    expect(short.message).toBe("Expected 4 bytes; only 2 bytes remain")
  })

  test.each(["\uFEFFhello", "A".repeat(500_000)])(
    "text frames preserve contents across encoding and parsing (%#)",
    text => {
      const items = [{ kind: "text" as const, text }, { kind: "ping" as const }]
      expect(frames.parseOrThrow(encode(items))).toEqual(items)
    }
  )

  test("encode rejects point coordinates that do not fit in a uint16", () => {
    const point = (x: number, y: number) => [{ kind: "point" as const, x, y }]
    expect(frames.parseOrThrow(encode(point(0, 0xffff)))).toEqual(
      point(0, 0xffff)
    )
    expect(() => encode(point(-1, 0))).toThrow("-1 is not a uint16")
    expect(() => encode(point(0, 0x10000))).toThrow("65536 is not a uint16")
    expect(() => encode(point(1.5, 0))).toThrow("1.5 is not a uint16")
  })

  test("elf follows the section table and the name table through at", () => {
    const file = prefix(elf, tinyElf)
    expect(file).toMatchObject({
      bits: 64,
      order: "LE",
      machine: 62,
      entry: 0x401000,
      sectionHeaderCount: 3,
      nameTable: 2
    })
    expect(file.sections.map(s => [s.name, s.offset, s.size])).toEqual([
      ["", 0, 0],
      [".text", 64, 4],
      [".shstrtab", 68, 17]
    ])

    const truncated = failure(elf.parsePrefix(tinyElf.slice(0, 200)))
    expect(truncated.message).toBe(
      "Expected uint64LE (8 bytes); only 0 bytes remain"
    )
    expect(truncated.diagnostic.context).toContain("section headers")

    const badNames = tinyElf.slice()
    badNames[62] = 9 // e_shstrndx
    expect(failure(elf.parsePrefix(badNames)).message).toBe(
      "no section 9 for names"
    )
  })

  test("zip reads the central directory and each entry's stored data", () => {
    const files = prefix(zip, tinyZip)
    const decoder = new TextDecoder()
    expect(files.map(f => [f.name, decoder.decode(f.data)])).toEqual([
      ["hello.txt", "hello\n"],
      ["dir/notes.md", "# notes\n"]
    ])
    expect(files[0]).toMatchObject({ method: 0, size: 6, localHeader: 0 })

    const badOffset = tinyZip.slice()
    badOffset.set([0xff, 0xff, 0xff, 0xff], tinyZip.length - 6)
    expect(failure(zip.parsePrefix(badOffset)).message).toBe(
      "Offset 4294967295 is past the end of the 230-byte input"
    )
    expect(failure(zip.parsePrefix(tinyZip.slice(0, 10))).message).toBe(
      "Expected at least 22 bytes"
    )
    const notZip = failure(zip.parsePrefix(new Uint8Array(22)))
    expect(notZip.message).toBe("Expected end of central directory, found 0x00")
  })
})
