import {
  advanceTo,
  createParserEngine,
  ensureCount,
  initialState,
  makeReply,
  type CoreParser,
  type CoreState
} from "../core.ts"
import type { Diagnostic } from "../errors.ts"
import {
  binaryEngine,
  requireBytes,
  requireUnits,
  type BinaryParser
} from "./engine.ts"
import {
  BinaryParseError,
  SourceBytes,
  type BinaryDiagnostic
} from "./errors.ts"

export type BitOrder = "msb-first" | "lsb-first"
export type BitInput = {
  readonly bytes: Uint8Array
  readonly order: BitOrder
  /** Used by parsePrefix to retain an unaligned remaining input. */
  readonly bitOffset?: number
}
/** withSpan and position inside a bit grammar use local bit offsets. */
export type BitParser<T> = CoreParser<T, BitInput, BinaryParseError>
type BitState = CoreState<BitInput>

/** Reject unsupported bit traversal orders at parser construction or entry. */
function checkOrder(order: BitOrder): void {
  if (order !== "msb-first" && order !== "lsb-first")
    throw new TypeError("bit order must be msb-first or lsb-first")
}

/** Return the full backing input length in bits, including any consumed prefix. */
const bitLength = (input: BitInput): number => input.bytes.length * 8

/** Translate a bit-offset diagnostic into byte offsets, keeping the bit span. */
function byteDiagnostic(
  diagnostic: Diagnostic,
  byteOffset = 0
): BinaryDiagnostic {
  const start = byteOffset * 8 + diagnostic.span.start
  const end = byteOffset * 8 + diagnostic.span.end
  return {
    ...diagnostic,
    span: { start: Math.floor(start / 8), end: Math.ceil(end / 8) },
    bitSpan: { start, end }
  }
}

/** Reads `n` bits (at most 53) starting at bit `offset` as a number. */
function readBits(input: BitInput, offset: number, n: number): number {
  const { bytes } = input
  const msbFirst = input.order === "msb-first"
  let value = 0
  let weight = 1
  for (let i = 0; i < n; i++) {
    const at = offset + i
    const shift = msbFirst ? 7 - (at & 7) : at & 7
    const bit = (bytes[at >> 3]! >> shift) & 1
    if (msbFirst) value = value * 2 + bit
    else {
      value += bit * weight
      weight *= 2
    }
  }
  return value
}

const bitEngine = createParserEngine<BitInput, BinaryParseError>({
  /** Validate a bit input and restore its optional unaligned prefix offset. */
  fromInput(input) {
    if (!(input.bytes instanceof Uint8Array))
      throw new TypeError("Bit parsers expect bytes in a Uint8Array")
    checkOrder(input.order)
    const offset = input.bitOffset ?? 0
    ensureCount(offset)
    if (offset > bitLength(input))
      throw new RangeError("bitOffset exceeds the input length")
    return initialState(input, offset)
  },
  isAtEnd: state => state.offset >= bitLength(state.source),
  remaining: state => ({ ...state.source, bitOffset: state.offset }),
  peek: state =>
    state.offset < bitLength(state.source)
      ? { value: String(readBits(state.source, state.offset, 1)), width: 1 }
      : { value: "", width: 0 },
  failureOffset: diagnostic => diagnostic.span.start,
  error: (diagnostic, input, sourceName) =>
    new BinaryParseError(
      byteDiagnostic(diagnostic),
      new SourceBytes(input.bytes, sourceName)
    )
})

const { makeParser, runParser, replySuccess } = bitEngine

/** Fail when the requested bit count exceeds the remaining region. */
const requireBits = (state: BitState, n: number) =>
  requireUnits(state, bitLength(state.source) - state.offset, n, "bits")

/** Move the bit cursor forward while retaining state metadata. */
const advance = (state: BitState, n: number): BitState =>
  advanceTo(state, state.offset + n)

/** Read up to 53 bits as an exact unsigned number in the input's bit order. */
function uint(n: number): BitParser<number> {
  ensureCount(n)
  if (n > 53)
    throw new RangeError("bit.uint supports at most 53 bits; use bit.bigUint")
  return makeParser(
    state =>
      requireBits(state, n) ??
      replySuccess(readBits(state.source, state.offset, n), advance(state, n))
  )
}

/** Read an arbitrary nonnegative bit count as an unsigned bigint. */
function bigUint(n: number): BitParser<bigint> {
  ensureCount(n)
  return makeParser(state => {
    const failure = requireBits(state, n)
    if (failure) return failure
    const msbFirst = state.source.order === "msb-first"
    let value = 0n
    for (let done = 0; done < n; done += 32) {
      const width = Math.min(32, n - done)
      const chunk = BigInt(readBits(state.source, state.offset + done, width))
      value = msbFirst
        ? (value << BigInt(width)) | chunk
        : value | (chunk << BigInt(done))
    }
    return replySuccess(value, advance(state, n))
  })
}

/** Consume the requested number of bits without returning a value. */
function skip(n: number): BitParser<void> {
  ensureCount(n)
  return makeParser(
    state => requireBits(state, n) ?? replySuccess(undefined, advance(state, n))
  )
}

/** Combinators in this namespace operate on bits, within a bitFields boundary. */
export const bit = { ...bitEngine.combinators, uint, bigUint, skip }

/** Consume exactly n bytes through a bit grammar. Unread bits cause a parse failure. */
export function bitFields<T>(
  n: number,
  inner: BitParser<T>,
  options: { readonly order?: BitOrder } = {}
): BinaryParser<T> {
  ensureCount(n)
  if (!Number.isSafeInteger(n * 8))
    throw new RangeError("bit field region is too large")
  const order = options.order ?? "msb-first"
  checkOrder(order)
  const description = `${n} bytes for bit fields`
  return binaryEngine.makeParser(state => {
    const failure = requireBytes(state, n, description)
    if (failure) return failure
    const bytes = state.source.subarray(state.offset, state.offset + n)
    const bits = runParser(inner, {
      source: { bytes, order },
      offset: 0,
      cutGeneration: state.cutGeneration
    })
    const { completionContext } = bits.state
    if (!bits.result.ok) {
      return binaryEngine.failRich(
        {
          ...bits.result.failure,
          diagnostic: byteDiagnostic(
            bits.result.failure.diagnostic,
            state.offset
          )
        },
        {
          ...state,
          offset: state.offset + Math.floor(bits.state.offset / 8),
          cutGeneration: bits.state.cutGeneration
        }
      )
    }
    if (bits.state.offset !== n * 8) {
      return binaryEngine.failRich(
        {
          diagnostic: byteDiagnostic(
            {
              kind: "expected",
              span: { start: bits.state.offset, end: bits.state.offset + 1 },
              expected: ["end of bit fields"],
              message: `Unconsumed bits: ${n * 8 - bits.state.offset}; consume padding explicitly with bit.skip`,
              ...(completionContext ? { context: completionContext } : {})
            },
            state.offset
          ),
          control: {
            kind: "recoverable",
            cutGeneration: bits.state.cutGeneration
          }
        },
        state
      )
    }
    return makeReply(
      {
        ...state,
        offset: state.offset + n,
        cutGeneration: bits.state.cutGeneration,
        ...(completionContext ? { completionContext } : {})
      },
      bits.result
    )
  })
}
