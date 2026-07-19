/**
 * Summarizes a V8 .cpuprofile: self-time per function, aggregated.
 * Usage: node bench/analyze-profile.ts bench/.profiles/<file>.cpuprofile
 */
import { readFileSync } from "node:fs"

const path = process.argv[2]
if (!path) throw new Error("usage: node bench/analyze-profile.ts <profile>")

type ProfileNode = {
  id: number
  callFrame: { functionName: string; url: string; lineNumber: number }
  children?: number[]
}
type Profile = {
  nodes: ProfileNode[]
  samples: number[]
  timeDeltas: number[]
}

const profile: Profile = JSON.parse(readFileSync(path, "utf8"))
const nodeById = new Map(profile.nodes.map(n => [n.id, n]))

const selfTime = new Map<string, number>()
let total = 0
for (let i = 0; i < profile.samples.length; i++) {
  const delta = profile.timeDeltas[i] ?? 0
  total += delta
  const node = nodeById.get(profile.samples[i]!)
  if (!node) continue
  const cf = node.callFrame
  const file = cf.url.split("/").slice(-2).join("/")
  const key = `${cf.functionName || "(anonymous)"} ${file}:${cf.lineNumber + 1}`
  selfTime.set(key, (selfTime.get(key) ?? 0) + delta)
}

const sorted = [...selfTime.entries()].sort((a, b) => b[1] - a[1])
console.log(`total sampled: ${(total / 1000).toFixed(1)}ms\n`)
for (const [key, time] of sorted.slice(0, 30)) {
  const pct = ((time / total) * 100).toFixed(1).padStart(5)
  console.log(`${pct}%  ${(time / 1000).toFixed(1).padStart(8)}ms  ${key}`)
}
