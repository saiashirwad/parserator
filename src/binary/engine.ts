import {
  createParserEngine,
  initialState,
  isFinal,
  waitForInput,
  makeReply,
  type CoreParser,
  type CoreParseResult,
  type CorePrefixResult,
  type IncrementalResult,
  type IncrementalParser,
  type CoreReply,
  type CoreState
} from "../core.ts"
import { byteInput } from "../incremental-input.ts"
import {
  BinaryParseError,
  SourceBytes,
  hexByte,
  type BinaryDiagnostic
} from "./errors.ts"

export type BinaryIncrementalResult<T> = IncrementalResult<
  T,
  Uint8Array,
  BinaryParseError
>
export type BinaryIncrementalParser<T> = IncrementalParser<
  T,
  Uint8Array,
  BinaryParseError
>

export type BinaryParser<T> = CoreParser<T, Uint8Array, BinaryParseError>
export type BinaryParseResult<T> = CoreParseResult<T, BinaryParseError>
export type BinaryPrefixResult<T> = CorePrefixResult<T, Uint8Array>
export type BinaryPrefixParseResult<T> = BinaryParseResult<
  BinaryPrefixResult<T>
>
export type BinaryState = CoreState<Uint8Array>

export const binaryEngine = createParserEngine<Uint8Array, BinaryParseError>({
  incrementalInput: byteInput,
  /** Reject non-byte inputs and initialize a cursor at the start of the view. */
  fromInput(input) {
    if (!(input instanceof Uint8Array))
      throw new TypeError("Binary parsers expect a Uint8Array")
    return initialState(input)
  },
  isAtEnd: state => state.offset >= state.source.length,
  remaining: state => state.source.subarray(state.offset),
  peek: state => {
    const byte = state.source[state.offset]
    return byte === undefined
      ? { value: "", width: 0 }
      : { value: `0x${hexByte(byte)}`, width: 1 }
  },
  // Compare in bits so failures inside one byte's bit fields keep their order.
  failureOffset: (diagnostic: BinaryDiagnostic) =>
    diagnostic.bitSpan?.start ?? diagnostic.span.start * 8,
  error: (diagnostic, input, sourceName) =>
    new BinaryParseError(diagnostic, new SourceBytes(input, sourceName))
})

/** Fails unless `n` units remain, naming what was being read. */
export function requireUnits<I>(
  state: CoreState<I>,
  remaining: number,
  n: number,
  unit: string,
  description = `${n} ${unit}`
): CoreReply<never, I> | undefined {
  if (n <= remaining) return undefined
  return makeReply(state, {
    ok: false,
    failure: {
      diagnostic: {
        kind: "expected",
        span: { start: state.offset, end: state.offset + remaining },
        expected: [description],
        found: `${remaining} ${unit}`,
        message: `Expected ${description}; only ${remaining} ${unit} remain`
      },
      control: { kind: "recoverable", cutGeneration: state.cutGeneration }
    }
  })
}

/** Fail unless the requested bytes remain within the current input region. */
export const requireBytes = (
  state: BinaryState,
  n: number,
  description?: string
): CoreReply<never, Uint8Array> | undefined =>
  requireUnits(
    state,
    state.source.length - state.offset,
    n,
    "bytes",
    description
  )

/** Wait for a fixed-width read without retrying any preceding parser work. */
export function* waitForBytes(
  state: BinaryState,
  n: number
): Generator<void, void, void> {
  while (state.source.length - state.offset < n && !isFinal(state))
    yield* waitForInput(state)
}
