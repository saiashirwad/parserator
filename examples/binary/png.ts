/**
 * PNG: an 8-byte signature, then chunks until IEND. Each chunk is
 * `length, type, data, crc`, and the CRC covers the type and the data.
 */
import {
  ascii,
  bytes,
  eof,
  lookahead,
  magic,
  parser,
  rest,
  struct,
  uint8,
  uint32BE,
  within,
  type BinaryParser
} from "../../src/binary/index.ts"

export type Png = typeof png.Type
export type PngHeader = typeof ihdr.Type

const signature = magic([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
]).expected("PNG signature")

const ihdr = struct({
  width: uint32BE,
  height: uint32BE,
  bitDepth: uint8,
  colorType: uint8,
  compression: uint8.validate(m => m === 0, "compression method must be 0"),
  filter: uint8.validate(m => m === 0, "filter method must be 0"),
  interlace: uint8.validate(i => i <= 1, "interlace method must be 0 or 1")
})

/** One chunk, its data read by `body`. Pass `expected` to demand a chunk type. */
const chunk = <T>(body: BinaryParser<T>, expected?: string) =>
  parser(function* () {
    const length = yield* uint32BE
    const signed = yield* lookahead(bytes(4 + length))
    const type = yield* chunkType(expected)
    const data = yield* within(length, body).context(`${type} data`)
    yield* checksum(type, crc32(signed))
    return { type, data }
  })

export const png = parser(function* () {
  yield* signature
  const { data: header } = yield* chunk(ihdr, "IHDR")
  const chunks = []
  while (true) {
    const { type, data } = yield* chunk(rest)
    if (type === "IEND") break
    chunks.push({ type, data })
  }
  yield* eof
  return { header, chunks }
})

const chunkType = (expected?: string) =>
  ascii(4).validate(
    type =>
      expected === undefined ||
      type === expected ||
      `expected ${expected} chunk, found ${type}`
  )

const checksum = (type: string, expected: number) =>
  uint32BE.validate(
    crc =>
      crc === expected ||
      `${type} CRC mismatch: expected ${hex8(expected)}, found ${hex8(crc)}`
  )

const hex8 = (value: number) => `0x${value.toString(16).padStart(8, "0")}`

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
