/**
 * Deterministic benchmark fixtures. No Math.random so runs are comparable.
 */

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(42)

const words = [
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "zeta",
  "eta",
  "theta",
  "iota",
  "kappa",
  "lambda",
  "mu",
  "nu",
  "xi",
  "omicron",
  "pi"
]

function randomValue(depth: number): unknown {
  const r = rand()
  if (depth <= 0 || r < 0.3) {
    const leaf = rand()
    if (leaf < 0.25) return Math.floor(rand() * 10000)
    if (leaf < 0.45) return rand() * 1000
    if (leaf < 0.7) return words[Math.floor(rand() * words.length)]
    if (leaf < 0.8) return rand() < 0.5
    if (leaf < 0.9) return null
    return `${words[Math.floor(rand() * words.length)]} ${words[Math.floor(rand() * words.length)]}`
  }
  if (r < 0.65) {
    const n = 2 + Math.floor(rand() * 6)
    return Array.from({ length: n }, () => randomValue(depth - 1))
  }
  const n = 2 + Math.floor(rand() * 6)
  const obj: Record<string, unknown> = {}
  for (let i = 0; i < n; i++) {
    obj[`${words[Math.floor(rand() * words.length)]}_${i}`] = randomValue(
      depth - 1
    )
  }
  return obj
}

export const jsonSmall = JSON.stringify({
  id: 1234,
  name: "benchmark fixture",
  active: true,
  score: 99.5,
  tags: ["parser", "combinator", "speed"],
  meta: null
})

export const jsonMedium = JSON.stringify(
  Array.from({ length: 60 }, () => randomValue(3))
)

export const jsonLarge = JSON.stringify(
  Array.from({ length: 900 }, () => randomValue(4))
)

// A long string-heavy document (exercises string parsing hot path)
export const jsonStrings = JSON.stringify(
  Array.from({ length: 500 }, (_, i) => ({
    key: `item_${i}`,
    text: `The quick brown fox jumps over the lazy dog number ${i} \n with an escape`,
    path: "C:\\Users\\test\\file.txt"
  }))
)

// Number-heavy document
export const jsonNumbers = JSON.stringify(
  Array.from({ length: 2000 }, (_, i) => i * 1.5 - 1000)
)

// CSV-like line-based fixture for micro benches
export const csvLines = Array.from(
  { length: 1000 },
  (_, i) => `${i},${words[i % words.length]},${(i * 1.5).toFixed(2)},true`
).join("\n")

export const identifiers = Array.from(
  { length: 2000 },
  (_, i) => `${words[i % words.length]}_${i}`
).join(" ")
