/**
 * WAV: a RIFF container whose first chunk, `fmt `, describes the audio.
 * The samples follow, so callers read the header with `parsePrefix`.
 */
import {
  magic,
  parser,
  rest,
  struct,
  uint16LE,
  uint32LE,
  within
} from "../../src/binary/index.ts"

export type WavFormat = typeof wavFormat.Type

/** Match an ASCII container tag and use its text as the expected label. */
const tag = (text: string) =>
  magic(new TextEncoder().encode(text)).expected(`"${text}"`)

const format = struct({
  audioFormat: uint16LE,
  channels: uint16LE,
  sampleRate: uint32LE,
  byteRate: uint32LE,
  blockAlign: uint16LE,
  bitsPerSample: uint16LE
})

export const wavFormat = parser(function* () {
  yield* tag("RIFF")
  yield* uint32LE.context("file size")
  yield* tag("WAVE")
  yield* tag("fmt ")
  const size = yield* uint32LE
  return yield* within(size, format.zipLeft(rest)).context("fmt chunk")
})
