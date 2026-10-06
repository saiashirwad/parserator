import { json } from "../examples/json-parser.ts"
import { jsonLarge, jsonMedium, jsonStrings } from "./fixtures.ts"

let sink = 0
for (let i = 0; i < 3; i++) {
  json.parseOrThrow(jsonMedium)
}
const start = performance.now()
for (let i = 0; i < 10; i++) {
  const r = json.parseOrThrow(jsonLarge) as unknown[]
  sink += r.length
  json.parseOrThrow(jsonStrings)
}
const elapsed = performance.now() - start
console.log(`parsed 10 iterations in ${elapsed.toFixed(1)}ms (sink=${sink})`)
