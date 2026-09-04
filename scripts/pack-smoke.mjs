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
    'if (!literal("ok").parseOrThrow("ok")) process.exit(1)',
    'if (typeof makeParser !== "function" || typeof ParseError !== "function") process.exit(1)',
    ""
  ].join("\n")
)
run(process.execPath, ["index.mjs"], consumer)

writeFileSync(
  join(consumer, "index.ts"),
  [
    'import { literal } from "parserator"',
    'import { makeParser } from "parserator/advanced"',
    'import { ParseError, type Span } from "parserator/diagnostics"',
    'const parser = literal("ok")',
    'parser.parseOrThrow("ok")',
    "void [makeParser, ParseError, {} as Span]",
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
