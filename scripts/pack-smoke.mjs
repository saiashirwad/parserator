import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { isAbsolute, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const temp = mkdtempSync(join(tmpdir(), "parserator-pack-"))
process.on("exit", () => rmSync(temp, { recursive: true, force: true }))
const consumer = join(temp, "consumer")
mkdirSync(consumer, { recursive: true })

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "inherit"
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`)
  }
}

const packJson = execFileSync(
  "npm",
  ["pack", "--json", "--pack-destination", temp],
  { cwd: root, encoding: "utf8" }
)
const packed = JSON.parse(packJson)
const tarball = packed[0]?.filename
if (typeof tarball !== "string") throw new Error("npm pack returned no tarball")
const tarballPath = isAbsolute(tarball) ? tarball : join(temp, tarball)

writeFileSync(
  join(consumer, "package.json"),
  JSON.stringify({
    name: "parserator-smoke-consumer",
    private: true,
    type: "module"
  })
)
run(
  "npm",
  ["install", "--ignore-scripts", "--no-package-lock", tarballPath],
  consumer
)

writeFileSync(
  join(consumer, "index.mjs"),
  [
    'import { literal } from "parserator"',
    'import { makeParser } from "parserator/advanced"',
    'import { ParseError } from "parserator/diagnostics"',
    'import { uint8, uint16BE } from "parserator/binary"',
    'if (!literal("ok").parseOrThrow("ok")) process.exit(1)',
    'if (typeof makeParser !== "function" || typeof ParseError !== "function") process.exit(1)',
    "if (uint8.parseOrThrow(new Uint8Array([7])) !== 7) process.exit(1)",
    'const session = literal("ok").incremental()',
    'if (session.push("o").status !== "needMore") process.exit(1)',
    'if (session.push("k").status !== "done") process.exit(1)',
    "const values = []",
    "for await (const value of uint16BE.stream([new Uint8Array([0]), new Uint8Array([7, 0, 8])])) values.push(value)",
    'if (String(values) !== "7,8") process.exit(1)',
    ""
  ].join("\n")
)
run(process.execPath, ["index.mjs"], consumer)

writeFileSync(
  join(consumer, "index.ts"),
  [
    'import { literal, type IncrementalResult } from "parserator"',
    'import { makeParser } from "parserator/advanced"',
    'import { ParseError, type Span } from "parserator/diagnostics"',
    'import { uint8, type BinaryParser } from "parserator/binary"',
    'const parser = literal("ok")',
    'parser.parseOrThrow("ok")',
    'const result: IncrementalResult<"ok"> = parser.incremental().push("ok")',
    'if (result.status === "done") { const rest: string = result.rest; void rest }',
    "const stream: AsyncGenerator<number> = uint8.stream([new Uint8Array([1])]); void stream",
    "void [makeParser, ParseError, {} as Span, uint8 as BinaryParser<number>]",
    ""
  ].join("\n")
)
const tsc = resolve(root, "node_modules/typescript/bin/tsc")
run(
  process.execPath,
  [
    tsc,
    "--ignoreConfig",
    "--noEmit",
    "--skipLibCheck",
    "--target",
    "ES2022",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "index.ts"
  ],
  consumer
)

writeFileSync(
  join(consumer, "index.html"),
  '<script type="module" src="/main.js"></script>\n'
)
writeFileSync(
  join(consumer, "main.js"),
  [
    'import { literal } from "parserator"',
    'import { makeParser } from "parserator/advanced"',
    'import { ParseError } from "parserator/diagnostics"',
    'literal("ok"); void [makeParser, ParseError]',
    ""
  ].join("\n")
)
const vite = resolve(root, "node_modules/vite/bin/vite.js")
run(
  process.execPath,
  [vite, "build", "--outDir", join(temp, "vite-dist")],
  consumer
)

console.log(`Package smoke test passed for ${tarball}`)
