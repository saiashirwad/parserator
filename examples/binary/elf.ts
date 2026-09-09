/**
 * ELF: the identification block fixes the word size and byte order, then the
 * header points at a section table whose names live inside one section.
 */
import {
  at,
  count,
  fail,
  cstring,
  magic,
  numbers,
  parser,
  skip,
  struct,
  uint8,
  type BinaryParser,
  type ByteOrder
} from "../../src/binary/index.ts"

export type Elf = typeof elf.Type

const oneOrTwo = (field: string) =>
  uint8.validate(v => v === 1 || v === 2, `${field} must be 1 or 2`)

const identification = parser(function* () {
  yield* magic([0x7f, 0x45, 0x4c, 0x46]).expected("ELF signature")
  const wordSize = yield* oneOrTwo("class")
  const byteOrder = yield* oneOrTwo("data")
  yield* uint8.validate(v => v === 1, "ELF version must be 1")
  const osabi = yield* uint8
  yield* skip(8)
  const order: ByteOrder = byteOrder === 1 ? "LE" : "BE"
  return { bits: wordSize === 1 ? 32 : 64, order, osabi }
})

export const elf = parser(function* () {
  const ident = yield* identification
  const { uint16, uint32, uint64 } = numbers(ident.order)
  const word = ident.bits === 64 ? uint64.map(Number) : uint32

  const header = yield* struct({
    type: uint16,
    machine: uint16,
    version: uint32,
    entry: word,
    programHeaders: word,
    sectionHeaders: word,
    flags: uint32,
    headerSize: uint16,
    programHeaderSize: uint16,
    programHeaderCount: uint16,
    sectionHeaderSize: uint16,
    sectionHeaderCount: uint16,
    nameTable: uint16
  }).context("ELF header")

  const layout = sectionHeader(uint32, word)
  const headers = yield* at(
    header.sectionHeaders,
    count(layout, header.sectionHeaderCount)
  ).context("section headers")
  const names = headers[header.nameTable]
  if (!names) return yield* fail(`no section ${header.nameTable} for names`)

  const sections = []
  for (const section of headers) {
    const name = yield* at(names.offset + section.name, cstring)
    sections.push({ ...section, name })
  }
  return { ...ident, ...header, sections }
})

const sectionHeader = (
  uint32: BinaryParser<number>,
  word: BinaryParser<number>
) =>
  struct({
    name: uint32,
    type: uint32,
    flags: word,
    address: word,
    offset: word,
    size: word,
    link: uint32,
    info: uint32,
    alignment: word,
    entrySize: word
  })

export const machineNames: Record<number, string> = {
  3: "x86",
  40: "ARM",
  62: "x86-64",
  183: "AArch64",
  243: "RISC-V"
}
