/** Compare full-input and resumed parsing without changing the grammar. */
import { bench, group, run } from "mitata"
import { uint16BE, utf8 } from "../src/binary/index.ts"
import { char, takeUntil } from "../src/index.ts"

const message = uint16BE.flatMap(length => utf8(length))
const payload = new TextEncoder().encode("hello ".repeat(128))
const wire = new Uint8Array(payload.length + 2)
wire[0] = payload.length >> 8
wire[1] = payload.length & 255
wire.set(payload, 2)

group("binary length-prefixed message", () => {
  bench("complete input", () => message.parseOrThrow(wire))
  for (const width of [1, 16, 256]) {
    const chunks: Uint8Array[] = []
    for (let offset = 0; offset < wire.length; offset += width)
      chunks.push(wire.subarray(offset, offset + width))
    bench(`${width}-byte chunks`, () => {
      const session = message.incremental()
      for (const chunk of chunks) session.push(chunk)
    })
  }
})

group("delimited text record", () => {
  const record = takeUntil(char("\n"))
  const source = "hello ".repeat(128) + "\n"
  bench("complete input", () => record.parseOrThrow(source))
  const chunks = Array.from(source)
  bench("one character per chunk", () => {
    const session = record.incremental()
    for (const chunk of chunks) session.push(chunk)
  })
})

await run()
