/**
 * Run: node examples/binary/png-file.ts [image.png]
 * With no path, write a ~3 MiB PNG and a corrupt copy to a new temp directory,
 * then read both from disk. The corrupt file deliberately exits with code 1.
 */
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { deflateSync } from "node:zlib"
import { BinaryParseError } from "../../src/binary/index.ts"
import { crc32, png } from "./png.ts"

async function parseFile(path: string) {
  const input = await readFile(path)
  const name = basename(path)
  console.log(`Reading ${name} (${input.length.toLocaleString("en-US")} bytes)`)
  // Buffer is a Uint8Array: pass it directly, keeping the filename in errors.
  const image = png.parseOrThrow(input, { sourceName: name })
  console.log({
    width: image.header.width,
    height: image.header.height,
    bitDepth: image.header.bitDepth,
    chunks: image.chunks.map(
      ({ type, data }) => `${type}: ${data.length} bytes`
    )
  })
}

function chunk(type: string, data: Uint8Array): Buffer {
  const result = Buffer.alloc(12 + data.length)
  result.writeUInt32BE(data.length, 0)
  result.write(type, 4, 4, "ascii")
  result.set(data, 8)
  result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4)
  return result
}

async function createDemoFiles(): Promise<string[]> {
  const width = 1024
  const height = 1024
  const stride = 1 + width * 3 // Filter byte, then RGB pixels for each row.
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = y * stride + 1 + x * 3
      pixels[offset] = x & 0xff
      pixels[offset + 1] = y & 0xff
      pixels[offset + 2] = (x ^ y) & 0xff
    }
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // 8 bits per channel.
  header[9] = 2 // RGB; remaining fields are zero.
  const good = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    // Valid zlib data without compression, to keep the demo file large.
    chunk("IDAT", deflateSync(pixels, { level: 0 })),
    chunk("IEND", Buffer.alloc(0))
  ])
  const bad = Buffer.from(good)
  const checksumOffset = good.length - 12 - 4 // IDAT CRC, just before IEND.
  bad[checksumOffset] = bad[checksumOffset]! ^ 0xff

  const directory = await mkdtemp(join(tmpdir(), "parserator-png-"))
  const paths = [join(directory, "good.png"), join(directory, "bad.png")]
  await writeFile(paths[0]!, good)
  await writeFile(paths[1]!, bad)
  console.log(`Demo files saved in ${directory}\n`)
  return paths
}

try {
  const paths = process.argv.slice(2)
  for (const path of paths.length ? paths : await createDemoFiles()) {
    await parseFile(path)
    console.log()
  }
} catch (error) {
  // parseOrThrow throws; catch at the CLI boundary for a readable diagnostic.
  if (error instanceof BinaryParseError) console.error(error.format())
  else if (error instanceof Error) console.error(error.message)
  else throw error
  process.exitCode = 1
}
