import type { BinaryParser } from "../../src/binary/index.ts"
import { elf, machineNames } from "./elf.ts"
import { hex, tinyElf, tinyPng, tinyZip } from "./fixtures.ts"
import { encode, frames } from "./frames.ts"
import { ipv4Header, protocolNames } from "./ipv4.ts"
import { png } from "./png.ts"
import { wavFormat } from "./wav.ts"
import { zip } from "./zip.ts"

/** Parsers that must reach the end of the file say so with `eof` themselves. */
function demo<T>(
  title: string,
  parser: BinaryParser<T>,
  inputs: Record<string, Uint8Array>,
  show: (value: T) => unknown = value => value
) {
  console.log(`=== ${title} ===\n`)
  for (const [name, input] of Object.entries(inputs)) {
    console.log(`Input: ${name} (${input.length} bytes)`)
    const result = parser.parsePrefix(input, { sourceName: name })
    if (result.success) console.log("Parsed:", show(result.value.value))
    else console.log(result.error.format())
    console.log()
  }
}

const corruptPng = tinyPng.slice()
corruptPng[45] = corruptPng[45]! ^ 0xff // flip a byte inside IDAT so its CRC no longer matches

demo("WAV format", wavFormat, {
  "tone.wav": hex(
    "52 49 46 46 24 08 00 00 57 41 56 45 66 6d 74 20 10 00 00 00" +
      "01 00 02 00 44 ac 00 00 10 b1 02 00 04 00 10 00 64 61 74 61"
  ),
  "aiff.bin": hex("46 4f 52 4d 00 00 08 24 41 49 46 46")
})

demo(
  "PNG",
  png,
  {
    "tiny.png": tinyPng,
    "corrupt.png": corruptPng,
    "not.png": hex("89 50 4e 47 00")
  },
  value => ({
    ...value.header,
    chunks: value.chunks.map(c => `${c.type}[${c.data.length}]`)
  })
)

demo(
  "IPv4 header",
  ipv4Header,
  {
    "tcp.bin": hex(
      "45 00 00 3c 1c 46 40 00 40 06 b1 e6 ac 10 0a 63 ac 10 0a 0c"
    ),
    "ipv6.bin": hex("60 00 00 00 00 00 00 00")
  },
  value => ({
    ...value,
    protocol: protocolNames[value.protocol] ?? value.protocol,
    options: value.options.length
  })
)

demo("Frames", frames, {
  "session.bin": encode([
    { kind: "ping" },
    { kind: "text", text: "héllo" },
    { kind: "point", x: 640, y: 480 }
  ]),
  "bad-tag.bin": hex("01 00 09 00"),
  "short.bin": hex("03 04 02 80")
})

const truncatedElf = tinyElf.slice(0, 200) // cuts through the section table

demo(
  "ELF",
  elf,
  { "tiny.elf": tinyElf, "truncated.elf": truncatedElf },
  value => ({
    bits: value.bits,
    order: value.order,
    machine: machineNames[value.machine] ?? value.machine,
    entry: `0x${value.entry.toString(16)}`,
    sections: value.sections.map(s => `${s.name || "(null)"}[${s.size}]`)
  })
)

const noDirectory = tinyZip.slice()
noDirectory.set([0xff, 0xff, 0xff, 0xff], tinyZip.length - 6) // directory offset

demo(
  "ZIP",
  zip,
  { "tiny.zip": tinyZip, "bad-offset.zip": noDirectory },
  files =>
    files.map(
      f => `${f.name}: ${JSON.stringify(new TextDecoder().decode(f.data))}`
    )
)
