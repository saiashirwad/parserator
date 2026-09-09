/**
 * ZIP: the end-of-central-directory record sits at the very end of the file
 * and points at the central directory, whose entries point at local headers.
 * Archive comments are not supported, so the end record is the last 22 bytes.
 */
import {
  at,
  bytes,
  count,
  magic,
  numbers,
  parser,
  size,
  skip,
  utf8,
  within
} from "../../src/binary/index.ts"

export type ZipEntry = (typeof zip.Type)[number]

const { uint16, uint32 } = numbers("LE")

const endRecord = parser(function* () {
  yield* magic([0x50, 0x4b, 0x05, 0x06]).expected("end of central directory")
  yield* skip(6) // disk numbers, entries on this disk
  const entries = yield* uint16
  const size = yield* uint32
  const offset = yield* uint32
  yield* uint16.validate(n => n === 0, "archive comments are not supported")
  return { entries, size, offset }
})

const centralEntry = parser(function* () {
  yield* magic([0x50, 0x4b, 0x01, 0x02]).expected("central directory entry")
  yield* skip(6) // versions, flags
  const method = yield* uint16
  yield* skip(4) // modification time and date
  const crc = yield* uint32
  const compressedSize = yield* uint32
  const size = yield* uint32
  const nameLength = yield* uint16
  const extraLength = yield* uint16
  const commentLength = yield* uint16
  yield* skip(8) // disk number, attributes
  const localHeader = yield* uint32
  const name = yield* utf8(nameLength)
  yield* skip(extraLength + commentLength)
  return { name, method, crc, size, compressedSize, localHeader }
})

const localData = (compressedSize: number) =>
  parser(function* () {
    yield* magic([0x50, 0x4b, 0x03, 0x04]).expected("local file header")
    yield* skip(22)
    const nameLength = yield* uint16
    const extraLength = yield* uint16
    yield* skip(nameLength + extraLength)
    return yield* bytes(compressedSize)
  })

export const zip = parser(function* () {
  const length = yield* size.validate(
    n => n >= 22,
    "Expected at least 22 bytes"
  )
  const end = yield* at(length - 22, endRecord)
  const directory = within(end.size, count(centralEntry, end.entries))
  const entries = yield* at(end.offset, directory).context("central directory")

  const files = []
  for (const entry of entries) {
    const data = yield* at(entry.localHeader, localData(entry.compressedSize))
    files.push({ ...entry, data })
  }
  return files
})
