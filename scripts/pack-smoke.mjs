import { execFileSync, spawnSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs"
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
    'import * as api from "parserator"',
    'import { literal, fatal } from "parserator"',
    'import { makeParser, runParser, SourceText } from "parserator/advanced"',
    'import { ParseError, SourceText as DiagnosticSourceText } from "parserator/diagnostics"',
    'assert.equal("SourceText" in api, false)',
    "assert.equal(DiagnosticSourceText, SourceText)",
    'assert.equal(new DiagnosticSourceText("diagnostic").text, "diagnostic")',
    'const parser = literal("ok")',
    'assert.deepEqual(parser.parsePrefix("ok!"), { success: true, value: "ok", offset: 2, rest: "!" })',
    'const scanner = makeParser((source, offset) => source.charAt(offset) === "😀"',
    '  ? { ok: true, value: "emoji", offset: offset + source.charWidthAt(offset), cut: false }',
    '  : { ok: false, offset, diagnostic: { kind: "expected", span: { start: 0, end: 2 }, expected: ["emoji"] }, cut: false, fatal: false })',
    'const source = new SourceText("😀!", "scanner.txt")',
    'assert.deepEqual(runParser(scanner, source, 0), { ok: true, value: "emoji", offset: 2, cut: false })',
    "const failed = runParser(scanner, source, 2)",
    "assert.equal(failed.ok, false)",
    "assert.equal(failed.offset, 2)",
    "assert.deepEqual(failed.diagnostic.span, { start: 0, end: 2 })",
    'const fatalResult = fatal("stop").parse("")',
    "assert.equal(fatalResult.success, false)",
    "assert.equal(fatalResult.error.fatal, true)",
    "assert.equal(fatalResult.error.toJSON().fatal, true)",
    'assert.equal(fatalResult.error.diagnostic.kind, "custom")',
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
    'import { makeParser, runParser, SourceText, type Reply } from "parserator/advanced"',
    'import { ParseError, SourceText as DiagnosticSourceText, type Span } from "parserator/diagnostics"',
    'type RootExports = typeof import("parserator")',
    'const sourceTextIsNotRoot: "SourceText" extends keyof RootExports ? false : true = true',
    'const advancedSource: SourceText = new SourceText("advanced")',
    'const diagnosticSource: DiagnosticSourceText = new DiagnosticSourceText("diagnostic")',
    "const sameSourceType: Equal<typeof advancedSource, typeof diagnosticSource> = true",
    "void [sourceTextIsNotRoot, sameSourceType]",
    'const prefix = literal("ok").parsePrefix("ok!")',
    "if (prefix.success) {",
    '  const exact: [Equal<typeof prefix.value, "ok">, Equal<typeof prefix.offset, number>, Equal<typeof prefix.rest, string>] = [true, true, true]',
    "  void exact",
    "}",
    'const advanced = makeParser<"ok">((_source, offset): Reply<"ok"> => ({ ok: true, value: "ok", offset, cut: false }))',
    'const reply = runParser(advanced, new SourceText(""), 0)',
    'if (reply.ok) { const exact: Equal<typeof reply.value, "ok"> = true; void exact }',
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
const readme = readFileSync(join(root, "README.md"), "utf8")
const snippets = [...readme.matchAll(/```ts\n([\s\S]*?)```/g)].map(
  match => match[1]
)
const examples = [
  {
    start: "import { char, parser, regex }",
    check:
      'if (point.parseOrThrow("(10,20)").y !== 20) throw new Error("point")',
    extra: ["const result = point.parse(", "const prefix = number.parsePrefix("]
  },
  {
    start: "import { commit, literal, parser, regex }",
    check:
      'if (letExpression.parseOrThrow("letx=") !== "x") throw new Error("commit")'
  },
  {
    start: "import { createLexemes, regex }",
    check:
      'if (lex.complete(and).parseOrThrow(" AND ") !== "AND" || lex.keyword("AND").parsePrefix("AND.é").success || lex.identifier.parseOrThrow("AND.é") !== "AND.é") throw new Error("lexemes")'
  },
  {
    start: "import { choice, literal, precedence, regex }",
    check:
      'if (expression.parseOrThrow("2+3*4") !== 14) throw new Error("precedence")'
  },
  {
    start: "import { makeParser, runParser, SourceText }",
    check:
      'if (!reply.ok || reply.value !== "😀" || reply.offset !== 2) throw new Error("scanner")'
  }
]
const readmeFiles = examples.map((example, index) => {
  const select = start => {
    const snippet = snippets.find(value => value.startsWith(start))
    if (!snippet) throw new Error(`README snippet missing: ${start}`)
    return snippet
  }
  const filename = `readme-${index}.ts`
  writeFileSync(
    join(consumer, filename),
    [
      select(example.start),
      ...(example.extra ?? []).map(select),
      example.check
    ].join("\n")
  )
  return filename
})
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
      ...(module === "NodeNext" ? ["--outDir", "compiled"] : ["--noEmit"]),
      "--strict",
      "--target",
      "ES2022",
      "--module",
      module,
      "--moduleResolution",
      resolution,
      "index.ts",
      ...readmeFiles
    ],
    consumer
  )
}

for (const file of ["index.ts", ...readmeFiles]) {
  run(
    process.execPath,
    [join("compiled", file.replace(/\.ts$/, ".js"))],
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
