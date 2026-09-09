import {
  ascii,
  magic,
  parser,
  uint8,
  uint16BE,
  within
} from "../../src/binary/index.ts"

const packet = parser(function* () {
  yield* magic([0xca, 0xfe]).expected("packet signature")
  const version = yield* uint8
  const length = yield* uint16BE
  const body = yield* within(length, ascii()).context("body")
  const expected = [...body].reduce((sum, c) => sum ^ c.charCodeAt(0), 0)
  yield* uint8.validate(
    sum => sum === expected || `checksum ${sum} should be ${expected}`
  )
  return { version, body }
})

const bytes = (text: string) =>
  Uint8Array.from(text.match(/[0-9a-f]{2}/g) ?? [], b => parseInt(b, 16))

const good = bytes("ca fe 01 00 05 68 65 6c 6c 6f 62")
const bad = bytes("ca fe 01 00 05 68 65 6c 6c 6f 00")

console.log(packet.parseOrThrow(good))
console.log()
const result = packet.parse(bad, { sourceName: "bad.bin" })
if (!result.success) console.log(result.error.format())
