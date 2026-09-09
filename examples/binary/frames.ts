/**
 * A small framed message protocol: a tag byte selects the message kind, a
 * LEB128 varint gives the payload length, and the payload is parsed by kind.
 */
import {
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

export type Frame =
  | { readonly kind: "ping" }
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "point"; readonly x: number; readonly y: number }

/** Unsigned LEB128: seven bits per byte, low group first, high bit continues. */
export const varint = parser(function* () {
  let value = 0
  for (let shift = 0; ; shift += 7) {
    if (shift > 49) yield* fail("varint does not fit in a number")
    const byte = yield* uint8
    const group = byte & 0x7f
    if (shift === 49 && group > 0x0f)
      yield* fail("varint does not fit in a number")
    value += group * 2 ** shift
    if ((byte & 0x80) === 0) return value
  }
})

/** A varint length, then exactly that many bytes read by `body`. */
const payload = <T>(body: BinaryParser<T>) =>
  parser(function* () {
    const length = yield* varint.context("payload length")
    return yield* within(length, body).context("payload")
  })

const ping = payload(eof).map(() => ({ kind: "ping" }) as const)
const text = payload(utf8()).map(text => ({ kind: "text", text }) as const)
const point = payload(uint16BE.zip(uint16BE)).map(
  ([x, y]) => ({ kind: "point", x, y }) as const
)

const kinds: Record<number, BinaryParser<Frame>> = {
  1: ping,
  2: text,
  3: point
}

/** Once the tag is read there is no other frame it could be, so commit. */
export const frame = parser(function* () {
  const tag = yield* uint8
    .commit()
    .validate(t => t in kinds || `unknown frame tag ${t}`)
  return yield* kinds[tag]!
}).context("frame")

export const frames = many(frame).zipLeft(eof)

/** Encodes frames back to bytes, so round trips can be checked. */
export function encode(items: readonly Frame[]): Uint8Array {
  const out: number[] = []
  /** Append a payload length in unsigned LEB128 form. */
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
      for (const byte of encoded) out.push(byte)
    } else {
      for (const value of [item.x, item.y]) {
        if (!Number.isInteger(value) || value < 0 || value > 0xffff)
          throw new RangeError(`point coordinate ${value} is not a uint16`)
      }
      out.push(0x03, 4, item.x >> 8, item.x & 0xff, item.y >> 8, item.y & 0xff)
    }
  }
  return Uint8Array.from(out)
}
