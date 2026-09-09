/**
 * A small framed message protocol: a tag byte selects the message kind, a
 * LEB128 varint gives the payload length, and the payload is parsed by kind.
 */
import {
  commit,
  eof,
  fail,
  many,
  parser,
  uint8,
  uint16BE,
  utf8,
  within,
  type BinaryParser
} from "../../src/binary/index.ts"

export type Frame = typeof frame.Type

/** Unsigned LEB128: seven bits per byte, low group first, high bit continues. */
export const varint = parser(function* () {
  let value = 0
  for (let shift = 0; ; shift += 7) {
    if (shift > 49) yield* fail("varint does not fit in a number")
    const byte = yield* uint8
    value += (byte & 0x7f) * 2 ** shift
    if ((byte & 0x80) === 0) return value
  }
})

/** A varint length, then exactly that many bytes read by `body`. */
const payload = <T>(body: BinaryParser<T>) =>
  parser(function* () {
    const length = yield* varint.context("payload length")
    return yield* within(length, body).context("payload")
  })

/** Once the tag is read there is no other frame it could be, so commit. */
export const frame = parser(function* () {
  const tag = yield* uint8.context("tag")
  yield* commit()
  switch (tag) {
    case 0x01:
      yield* payload(eof)
      return { kind: "ping" } as const
    case 0x02:
      return { kind: "text", text: yield* payload(utf8()) } as const
    case 0x03: {
      const [x, y] = yield* payload(uint16BE.zip(uint16BE))
      return { kind: "point", x, y } as const
    }
    default:
      return yield* fail(`unknown frame tag ${tag}`)
  }
}).context("frame")

export const frames = many(frame).zipLeft(eof)

/** Encodes frames back to bytes, so round trips can be checked. */
export function encode(items: readonly Frame[]): Uint8Array {
  const out: number[] = []
  const pushVarint = (n: number) => {
    do {
      const group = n % 128
      n = Math.floor(n / 128)
      out.push(n > 0 ? group | 0x80 : group)
    } while (n > 0)
  }
  for (const item of items) {
    if (item.kind === "ping") out.push(0x01, 0)
    else if (item.kind === "text") {
      const encoded = new TextEncoder().encode(item.text)
      out.push(0x02)
      pushVarint(encoded.length)
      out.push(...encoded)
    } else
      out.push(0x03, 4, item.x >> 8, item.x & 0xff, item.y >> 8, item.y & 0xff)
  }
  return Uint8Array.from(out)
}
