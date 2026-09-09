/** Byte-oriented parsers. Offsets are relative to the supplied input view. */
import {
  advanceTo,
  ensureCount,
  makeReply,
  isFinal,
  waitForInput
} from "../core.ts"
import {
  binaryEngine,
  requireBytes,
  waitForBytes,
  type BinaryParser,
  type BinaryState
} from "./engine.ts"
import { hexByte } from "./errors.ts"

export type {
  BinaryParser,
  BinaryIncrementalParser,
  BinaryIncrementalResult,
  BinaryParseResult,
  BinaryPrefixResult,
  BinaryPrefixParseResult
} from "./engine.ts"
export { BinaryParseError, SourceBytes, hex } from "./errors.ts"
export type { BinaryDiagnostic, BinaryDiagnosticJson } from "./errors.ts"
export { bit, bitFields } from "./bits.ts"
export type { BitParser, BitInput, BitOrder } from "./bits.ts"
export type { Diagnostic, Span } from "../errors.ts"

export const {
  Parser,
  parser,
  recursive,
  succeed,
  fail,
  fatal,
  eof,
  position,
  notFollowedBy,
  lookahead,
  probe,
  attempt,
  commit,
  between,
  many,
  many1,
  skipMany,
  optional,
  atLeast,
  count,
  sepBy,
  sepBy1,
  sepEndBy,
  sepEndBy1,
  choice,
  sequence,
  struct
} = binaryEngine

const { makeRead, makeResumable, runResumable, replySuccess, failureAt } =
  binaryEngine

/** Move the byte cursor forward while retaining state metadata. */
const advance = (state: BinaryState, n: number): BinaryState =>
  advanceTo(state, state.offset + n)

/** Returns a view sharing the input's memory. Use .map(value => value.slice()) for a copy. */
export function bytes(n: number): BinaryParser<Uint8Array> {
  ensureCount(n)
  const description = `${n} bytes`
  return makeRead(
    state =>
      requireBytes(state, n, description) ??
      replySuccess(
        state.source.subarray(state.offset, state.offset + n),
        advance(state, n)
      ),
    state => state.source.length - state.offset >= n
  )
}

/** The length of the input, or of the enclosing `within` region. */
export const size: BinaryParser<number> = makeResumable(function* (state) {
  while (!isFinal(state)) yield* waitForInput(state)
  return replySuccess(state.source.length, state)
})

/** Every byte left in the input, or in the enclosing `within` region. */
export const rest: BinaryParser<Uint8Array> = makeResumable(function* (state) {
  while (!isFinal(state)) yield* waitForInput(state)
  return replySuccess(
    state.source.subarray(state.offset),
    advanceTo(state, state.source.length)
  )
})

/**
 * Run `inner` over exactly the next `n` bytes. Inside, `rest` and `eof` see
 * the region's end. `inner` must consume the whole region, and its failures
 * keep their offsets relative to the full input.
 */
export function within<T>(n: number, inner: BinaryParser<T>): BinaryParser<T> {
  ensureCount(n)
  return makeResumable(function* (state) {
    yield* waitForBytes(state, n)
    const failure = requireBytes(state, n)
    if (failure) return failure
    const end = state.offset + n
    const reply = yield* runResumable(inner, {
      ...state,
      source: state.source.subarray(0, end),
      input: undefined
    })
    const after = { ...reply.state, source: state.source, input: state.input }
    if (!reply.result.ok) return makeReply(after, reply.result)
    if (after.offset !== end) {
      return failureAt(after, {
        kind: "expected",
        span: { start: after.offset, end: after.offset + 1 },
        expected: [`end of ${n} bytes`],
        found: `0x${hexByte(state.source[after.offset]!)}`,
        message: `Unconsumed bytes: ${end - after.offset} of ${n}`
      })
    }
    return replySuccess(reply.result.value, after)
  })
}

/** Match a fixed byte signature. The signature is copied at construction time. */
export function magic(
  signature: readonly number[] | Uint8Array
): BinaryParser<Uint8Array> {
  for (const value of signature) {
    if (!Number.isInteger(value) || value < 0 || value > 255)
      throw new RangeError("magic expects bytes between 0 and 255")
  }
  const expected = Uint8Array.from(signature)
  const description = `[${Array.from(expected, hexByte).join(" ")}]`
  return makeResumable(function* (state) {
    for (let index = 0; index < expected.length; index++) {
      const offset = state.offset + index
      yield* waitForBytes(state, index + 1)
      const found = state.source[offset]
      if (found !== expected[index]) {
        return failureAt(state, {
          kind: "expected",
          span: { start: offset, end: offset + (found === undefined ? 0 : 1) },
          expected: [description],
          found: found === undefined ? "end of input" : `0x${hexByte(found)}`
        })
      }
    }
    return replySuccess(
      state.source.subarray(state.offset, state.offset + expected.length),
      advance(state, expected.length)
    )
  })
}

/** Reads up to 4 bytes as an unsigned integer without allocating a DataView. */
function readUint(
  source: Uint8Array,
  offset: number,
  width: number,
  littleEndian: boolean
): number {
  let value = 0
  for (let i = 0; i < width; i++) {
    const index = littleEndian ? offset + width - 1 - i : offset + i
    value = value * 256 + source[index]!
  }
  return value
}

/** Combine two 32-bit halves into an unsigned 64-bit integer in the given order. */
function readBigUint(
  source: Uint8Array,
  offset: number,
  littleEndian: boolean
): bigint {
  const [highOffset, lowOffset] = littleEndian
    ? [offset + 4, offset]
    : [offset, offset + 4]
  return (
    (BigInt(readUint(source, highOffset, 4, littleEndian)) << 32n) |
    BigInt(readUint(source, lowOffset, 4, littleEndian))
  )
}

/** Create a DataView restricted to the supplied Uint8Array view. */
const viewOf = (source: Uint8Array): DataView =>
  new DataView(source.buffer, source.byteOffset, source.byteLength)

/** Check the input width before reading and advancing a numeric primitive. */
function numeric<T>(
  width: number,
  name: string,
  read: (source: Uint8Array, offset: number) => T
): BinaryParser<T> {
  const description = `${name} (${width} byte${width === 1 ? "" : "s"})`
  return makeRead(
    state =>
      requireBytes(state, width, description) ??
      replySuccess(read(state.source, state.offset), advance(state, width)),
    state => state.source.length - state.offset >= width
  )
}

export type ByteOrder = "BE" | "LE"

/** Every numeric reader for one byte order, for formats that declare it at runtime. */
export function numbers(order: ByteOrder) {
  const le = order === "LE"
  /** Build an unsigned reader for a fixed byte width and the selected order. */
  const uint = (width: number) => (s: Uint8Array, o: number) =>
    readUint(s, o, width, le)
  /** Interpret an unsigned read as a signed two's-complement value. */
  const int = (width: number) => {
    const read = uint(width)
    const limit = 2 ** (width * 8)
    return (s: Uint8Array, o: number) => {
      const value = read(s, o)
      return value >= limit / 2 ? value - limit : value
    }
  }
  return {
    uint8: numeric(1, "uint8", (s, o) => s[o]!),
    uint16: numeric(2, `uint16${order}`, uint(2)),
    uint32: numeric(4, `uint32${order}`, uint(4)),
    uint64: numeric(8, `uint64${order}`, (s, o) => readBigUint(s, o, le)),
    int8: numeric(1, "int8", int(1)),
    int16: numeric(2, `int16${order}`, int(2)),
    int32: numeric(4, `int32${order}`, int(4)),
    int64: numeric(8, `int64${order}`, (s, o) =>
      BigInt.asIntN(64, readBigUint(s, o, le))
    ),
    float32: numeric(4, `float32${order}`, (s, o) =>
      viewOf(s).getFloat32(o, le)
    ),
    float64: numeric(8, `float64${order}`, (s, o) =>
      viewOf(s).getFloat64(o, le)
    )
  }
}

const be = numbers("BE")
const le = numbers("LE")

export const uint8 = be.uint8
export const int8 = be.int8
export const uint16BE = be.uint16
export const uint16LE = le.uint16
export const uint32BE = be.uint32
export const uint32LE = le.uint32
export const uint64BE = be.uint64
export const uint64LE = le.uint64
export const int16BE = be.int16
export const int16LE = le.int16
export const int32BE = be.int32
export const int32LE = le.int32
export const int64BE = be.int64
export const int64LE = le.int64
export const float32BE = be.float32
export const float32LE = le.float32
export const float64BE = be.float64
export const float64LE = le.float64

/** Consume `n` bytes and discard them. */
export function skip(n: number): BinaryParser<void> {
  ensureCount(n)
  return makeRead(
    state =>
      requireBytes(state, n, `${n} bytes to skip`) ??
      replySuccess(undefined, advance(state, n)),
    state => state.source.length - state.offset >= n
  )
}

/** Every byte, possibly none, while `predicate` holds. Returns a shared view. */
export function takeWhile(
  predicate: (byte: number) => boolean
): BinaryParser<Uint8Array> {
  return makeResumable(function* (state) {
    let end = state.offset
    while (true) {
      while (end < state.source.length && predicate(state.source[end]!)) end++
      if (end < state.source.length || isFinal(state)) break
      yield* waitForInput(state)
    }
    return replySuccess(
      state.source.subarray(state.offset, end),
      advanceTo(state, end)
    )
  })
}

/** Every byte before the next `byte`, which must exist and is left unconsumed. */
export function bytesUntil(byte: number): BinaryParser<Uint8Array> {
  if (!Number.isInteger(byte) || byte < 0 || byte > 255)
    throw new RangeError("bytesUntil expects a byte between 0 and 255")
  const description = `0x${hexByte(byte)} before the end of input`
  return makeResumable(function* (state) {
    let searched = state.offset
    let end: number
    while (true) {
      end = state.source.indexOf(byte, searched)
      if (end >= 0 || isFinal(state)) break
      searched = state.source.length
      yield* waitForInput(state)
    }
    if (end < 0) {
      return failureAt(state, {
        kind: "expected",
        span: { start: state.offset, end: state.source.length },
        expected: [description],
        found: "end of input"
      })
    }
    return replySuccess(
      state.source.subarray(state.offset, end),
      advanceTo(state, end)
    )
  })
}

const utf8Decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })

/** Turn invalid UTF-8 into a parser failure instead of a decoder exception. */
const decodeUtf8 = (raw: Uint8Array): BinaryParser<string> => {
  try {
    return succeed(utf8Decoder.decode(raw))
  } catch {
    return fail("Expected valid UTF-8")
  }
}

/** `n` bytes, or the rest of the region, each below 0x80, as a string. */
export function ascii(n?: number): BinaryParser<string> {
  const what = n === undefined ? "ASCII text" : `${n} ASCII bytes`
  return (n === undefined ? rest : bytes(n))
    .validate(raw => raw.every(byte => byte < 0x80), `Expected ${what}`)
    .map(raw => utf8Decoder.decode(raw))
}

/** `n` bytes, or the rest of the region, decoded as UTF-8. Invalid input fails. */
export function utf8(n?: number): BinaryParser<string> {
  return (n === undefined ? rest : bytes(n)).flatMap(decodeUtf8)
}

/** A NUL-terminated UTF-8 string. The terminator is consumed and dropped. */
export const cstring: BinaryParser<string> = bytesUntil(0)
  .flatMap(decodeUtf8)
  .zipLeft(skip(1))
  .expected("NUL-terminated string")

/**
 * Run `inner` at an absolute byte offset, then return to the current position.
 * Inside `within`, the offset is still measured from the start of the input,
 * but it cannot reach past the region.
 */
export function at<T>(offset: number, inner: BinaryParser<T>): BinaryParser<T> {
  ensureCount(offset)
  return makeResumable(function* (state) {
    while (offset > state.source.length && !isFinal(state))
      yield* waitForInput(state)
    const size = state.source.length
    if (offset > size) {
      return failureAt(state, {
        kind: "expected",
        span: { start: state.offset, end: state.offset },
        expected: [`offset ${offset} within ${size} bytes`],
        message: `Offset ${offset} is past the end of the ${size}-byte input`
      })
    }
    const reply = yield* runResumable(inner, advanceTo(state, offset))
    if (!reply.result.ok) return reply
    return replySuccess(reply.result.value, {
      ...reply.state,
      offset: state.offset
    })
  })
}
