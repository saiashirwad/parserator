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
  [
    "pack",
    "--offline",
    "--no-audit",
    "--no-fund",
    "--ignore-scripts",
    "--json",
    "--pack-destination",
    temp
  ],
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
  [
    "install",
    "--offline",
    "--no-audit",
    "--no-fund",
    "--ignore-scripts",
    "--no-package-lock",
    tarballPath
  ],
  consumer
)

writeFileSync(
  join(consumer, "index.mjs"),
  [
    'import assert from "node:assert/strict"',
    'import { literal } from "parserator"',
    'import { makeParser } from "parserator/advanced"',
    'import { ParseError } from "parserator/diagnostics"',
    'const parser = literal("ok")',
    'assert.equal(parser.parseOrThrow("ok"), "ok")',
    'assert.equal(typeof makeParser, "function")',
    'assert.equal("then" in parser, false)',
    "assert.equal(await Promise.resolve(parser), parser)",
    'const result = parser.parse("no", { sourceName: "consumer.txt" })',
    "assert.equal(result.success, false)",
    "assert.ok(result.error instanceof ParseError)",
    'const plain = result.error.format({ style: "plain" })',
    'const ansi = result.error.format({ style: "ansi" })',
    "assert.match(plain, /consumer\\.txt:line 1, column 1:/)",
    'assert.ok(!plain.includes("\\x1b["))',
    'assert.ok(ansi.includes("\\x1b["))',
    'assert.equal(ansi.replace(/\\x1b\\[[0-9;]*m/g, ""), plain)',
    ""
  ].join("\n")
)
run(process.execPath, ["index.mjs"], consumer)

writeFileSync(
  join(consumer, "index.ts"),
  [
    'import { literal, parser, choice, sequence } from "parserator"',
    'import { makeParser } from "parserator/advanced"',
    'import { ParseError, type Span } from "parserator/diagnostics"',
    "type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false",
    'const value = literal("ok").parseOrThrow("ok")',
    "const generated = parser(function* () {",
    '  const yielded = yield* literal("ok")',
    '  const exact: Equal<typeof yielded, "ok"> = true',
    "  void exact",
    "  return yielded",
    '}).parseOrThrow("ok")',
    'const union = choice(literal("yes"), literal("no")).parseOrThrow("yes")',
    'const tuple = sequence([literal("a"), literal("b")]).parseOrThrow("ab")',
    'const checks: [Equal<typeof value, "ok">, Equal<typeof generated, "ok">, Equal<typeof union, "yes" | "no">, Equal<typeof tuple, ["a", "b"]>] = [true, true, true, true]',
    "void [makeParser, ParseError, {} as Span, checks]",
    ""
  ].join("\n")
)
const tsc = resolve(root, "node_modules/typescript/bin/tsc")
for (const [module, resolution] of [
  ["NodeNext", "NodeNext"],
  ["ESNext", "Bundler"]
]) {
  run(
    process.execPath,
    [
      tsc,
      "--ignoreConfig",
      "--noEmit",
      "--strict",
      "--target",
      "ES2022",
      "--module",
      module,
      "--moduleResolution",
      resolution,
      "index.ts"
    ],
    consumer
  )
}

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
    'const result = literal("ok").parse("bad", { sourceName: "browser.txt" })',
    'document.body.textContent = result.success ? result.value : result.error.format({ style: "plain" })',
    "globalThis.parseratorSmoke = { makeParser, ParseError }",
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
