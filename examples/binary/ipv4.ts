/**
 * IPv4 header: 20 fixed bytes of bit fields and integers, then options sized
 * by the IHL field. The payload is left to the caller.
 */
import {
  bit,
  bitFields,
  bytes,
  parser,
  uint8,
  uint16BE
} from "../../src/binary/index.ts"

export type Ipv4Header = typeof ipv4Header.Type

const versionAndLength = bitFields(
  1,
  bit.parser(function* () {
    yield* bit.uint(4).validate(v => v === 4, "IP version must be 4")
    const words = yield* bit
      .uint(4)
      .validate(w => w >= 5, "IHL must be at least 5")
    return words * 4
  })
)

const serviceType = bitFields(
  1,
  bit.parser(function* () {
    const dscp = yield* bit.uint(6)
    const ecn = yield* bit.uint(2)
    return { dscp, ecn }
  })
)

const flagsAndOffset = bitFields(
  2,
  bit.parser(function* () {
    yield* bit.skip(1)
    const dontFragment = yield* flag
    const moreFragments = yield* flag
    const fragmentOffset = yield* bit.uint(13)
    return { flags: { dontFragment, moreFragments }, fragmentOffset }
  })
)

const flag = bit.uint(1).map(Boolean)
const address = bytes(4).map(octets => octets.join("."))

export const ipv4Header = parser(function* () {
  const headerLength = yield* versionAndLength
  const { dscp, ecn } = yield* serviceType
  const totalLength = yield* uint16BE
  const identification = yield* uint16BE
  const { flags, fragmentOffset } = yield* flagsAndOffset
  const ttl = yield* uint8
  const protocol = yield* uint8
  const checksum = yield* uint16BE
  const source = yield* address
  const destination = yield* address
  const options = yield* bytes(headerLength - 20).context("options")
  return {
    headerLength,
    dscp,
    ecn,
    totalLength,
    identification,
    flags,
    fragmentOffset,
    ttl,
    protocol,
    checksum,
    source,
    destination,
    options
  }
}).context("IPv4 header")

export const protocolNames: Record<number, string> = {
  1: "ICMP",
  6: "TCP",
  17: "UDP"
}
