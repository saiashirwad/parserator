import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import * as P from "../src/index.ts"

const fixture = new URL("./control-baseline.json", import.meta.url)
const lit = value => ["lit", value]
const seq = (...children) => ["seq", ...children]
const choice = (...children) => ["choice", ...children]
const unary = (op, child) => [op, child]
const A = lit("a"),
  B = lit("b"),
  C = ["cut"],
  F = ["fail"],
  X = ["fatal"],
  S = ["succeed"]

function compile(ast, events) {
  const [op, ...args] = ast
  const c = child => compile(child, events)
  switch (op) {
    case "lit":
      return P.literal(args[0])
    case "succeed":
      return P.succeed("unit")
    case "cut":
      return P.commit()
    case "fail":
      return P.fail("failure")
    case "fatal":
      return P.fatal("fatal")
    case "seq":
      return P.sequence(args.map(c))
    case "choice":
      return P.choice(...args.map(c))
    case "mark":
      return P.succeed(undefined).flatMap(() => {
        events.push("fallback")
        return c(args[0])
      })
    case "count":
    case "atLeast":
      return P[op](c(args[0]), args[1])
    case "sepBy":
    case "sepBy1":
    case "sepEndBy":
    case "sepEndBy1":
      return P[op](c(args[0]), c(args[1]))
    case "chainLeft1":
    case "chainRight1":
      return P[op](
        c(args[0]),
        c(args[1]).map(() => (left, right) => [left, right])
      )
    case "generator":
      return P.parser(function* () {
        events.push("enter")
        try {
          const value = yield* c(args[0])
          events.push("resume")
          return value
        } finally {
          events.push("finally")
        }
      })
    case "throw":
      return c(args[0]).map(() => {
        events.push("throw")
        throw new TypeError("callback sentinel")
      })
    case "metadata":
      return c(args[0]).context("inner").context("outer")
    default: {
      assert.ok(
        [
          "optional",
          "many",
          "many1",
          "skipMany",
          "attempt",
          "lookahead",
          "probe",
          "notFollowedBy",
          "takeUntil",
          "takeUpto",
          "skipUntil"
        ].includes(op),
        `Unknown AST operation: ${op}`
      )
      return P[op](c(args[0]))
    }
  }
}

function normalize(result, metadata) {
  if (result.success) {
    return {
      success: true,
      value: result.value,
      offset: result.offset,
      rest: result.rest
    }
  }
  const { diagnostic, source } = result.error
  const fatal = result.error.fatal
  return {
    success: false,
    fatal,
    diagnostic: {
      span: diagnostic.span,
      ...(metadata
        ? {
            kind: fatal ? "fatal" : diagnostic.kind,
            found: diagnostic.found,
            context: diagnostic.context,
            sourceName: source.name,
            sourceText: source.text
          }
        : {})
    }
  }
}

function observe(ast, input, wrapped, metadata) {
  const events = []
  const grammar = wrapped ? choice(ast, ["mark", S]) : ast
  const parser = compile(grammar, events)
  try {
    return {
      result: normalize(
        parser.parsePrefix(input, { sourceName: "regression" }),
        metadata
      ),
      events
    }
  } catch (error) {
    if (
      !(error instanceof Error) ||
      (!error.message.includes("must consume input") &&
        error.message !== "callback sentinel")
    )
      throw error
    return { throws: { name: error.name, message: error.message }, events }
  }
}

const named = [
  ["consumed ordinary failure", seq(A, F)],
  ["cut failure", seq(A, C, F)],
  ["attempt failed cut", unary("attempt", seq(A, C, F))],
  ["attempt successful cut then fail", seq(unary("attempt", seq(A, C)), F)],
  ["inherited cut inner choice", seq(C, choice(B, A))],
  ["fresh cut inner choice", seq(C, choice(seq(C, B), A))],
  ["inherited cut optional", seq(C, unary("optional", B), A)],
  ["inherited cut many", seq(C, unary("many", B), A)],
  ["many retains cuts and stops", unary("many", seq(A, C))],
  ["many cuts then later fail", seq(unary("many", seq(A, C)), B)],
  ["many fresh cut failure", unary("many", seq(A, C, B))],
  ["many attempted cut failure", unary("many", unary("attempt", seq(A, C, B)))],
  ["lookahead successful cut then fail", seq(unary("lookahead", seq(A, C)), F)],
  ["lookahead failed cut", unary("lookahead", seq(A, C, F))],
  ["lookahead fatal", unary("lookahead", seq(A, C, X))],
  ["attempt fatal", unary("attempt", seq(A, C, X))],
  ["partial literal position", lit("ab")],
  ["many empty progress", unary("many", S)],
  ["many lookahead progress", unary("many", unary("lookahead", A))],
  ["outer cut survives isolated attempt", seq(C, unary("attempt", seq(C, F)))],
  ["outer cut survives lookahead", seq(C, unary("lookahead", seq(C, F)))],
  ["unicode partial surrogate", lit("😀b")],
  ["unicode combining literal", lit("é")],
  ["failure metadata", ["metadata", lit("😀a")]],
  ["fatal metadata", ["metadata", seq(A, X)]]
]
for (const op of [
  "probe",
  "notFollowedBy",
  "optional",
  "many1",
  "skipMany",
  "takeUntil",
  "takeUpto",
  "skipUntil"
]) {
  for (const child of [
    A,
    seq(A, C),
    seq(A, C, B),
    seq(A, C, F),
    seq(A, X),
    lit("😀")
  ]) {
    named.push([`${op} ${JSON.stringify(child)}`, unary(op, child)])
    named.push([
      `inherited cut ${op} ${JSON.stringify(child)}`,
      seq(C, unary(op, child), F)
    ])
  }
}
for (const op of [
  "sepBy",
  "sepBy1",
  "sepEndBy",
  "sepEndBy1",
  "chainLeft1",
  "chainRight1"
]) {
  for (const item of [A, seq(A, C), seq(A, C, B), seq(A, X)]) {
    for (const separator of [
      lit(","),
      seq(lit(","), C),
      seq(lit(","), C, B),
      seq(lit(","), X)
    ]) {
      named.push([
        `${op} ${JSON.stringify([item, separator])}`,
        [op, item, separator]
      ])
    }
  }
}
for (const op of ["count", "atLeast"]) {
  for (const child of [A, seq(A, C), seq(A, C, B), seq(A, X)]) {
    for (const n of [0, 1, 2])
      named.push([`${op} ${n} ${JSON.stringify(child)}`, [op, child, n]])
  }
}
for (const child of [
  A,
  seq(A, F),
  seq(A, C, F),
  seq(A, X),
  ["throw", A],
  ["generator", ["throw", A]]
]) {
  named.push([
    `generator cleanup ${JSON.stringify(child)}`,
    ["generator", child]
  ])
}
const leaves = [A, B, lit("ab"), lit(""), lit("😀"), lit("é"), C, F, X, S]
const ops = [
  "optional",
  "many",
  "attempt",
  "lookahead",
  "probe",
  "notFollowedBy"
]
const exhaustive = [...leaves]
for (const op of ops)
  for (const child of leaves) exhaustive.push(unary(op, child))
for (const left of leaves)
  for (const right of leaves)
    exhaustive.push(seq(left, right), choice(left, right))
let seed = 0x12345678
const next = n => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed % n
}
function generate(depth) {
  if (!depth || next(5) === 0) return leaves[next(leaves.length)]
  const op = next(ops.length + 2)
  return op < ops.length
    ? unary(ops[op], generate(depth - 1))
    : [
        op === ops.length ? "seq" : "choice",
        generate(depth - 1),
        generate(depth - 1)
      ]
}
const random = Array.from({ length: 1000 }, () => generate(4))
const grammars = [
  ...named.map(([name, ast], i) => ({ id: `named-${i}`, name, ast })),
  ...exhaustive.map((ast, i) => ({
    id: `exhaustive-${i}`,
    name: `exhaustive-${i}`,
    ast
  })),
  ...random.map((ast, i) => ({ id: `seeded-${i}`, name: `seeded-${i}`, ast }))
]
const inputs = [""]
for (let n = 1; n <= 4; n++) {
  for (let bits = 0; bits < 2 ** n; bits++)
    inputs.push(
      Array.from({ length: n }, (_, i) => (bits & (1 << i) ? "b" : "a")).join(
        ""
      )
    )
}
inputs.push(
  "😀",
  "😀a",
  "😀b",
  "😀😀",
  "é",
  "éa",
  "é",
  "\ud83d",
  "a😀",
  "a,b",
  "a,a",
  "a,a,a",
  "a,",
  "a,,a",
  "a,ba",
  "a,baa",
  "ba,a",
  "\n😀"
)
const serialize = value =>
  JSON.stringify(value, (_key, item) =>
    item === undefined ? { $undefined: true } : item
  )
const summary = {
  named: named.length,
  exhaustive: exhaustive.length,
  seeded: random.length,
  uniqueSeeded: new Set(random.map(serialize)).size,
  inputs: inputs.length,
  comparisons: 0,
  success: 0,
  failure: 0,
  throws: 0,
  fallbackRuns: 0
}
const records = grammars.map(grammar => {
  const controlHash = createHash("sha256")
  const diagnosticHash = createHash("sha256")
  for (const input of inputs)
    for (const wrapped of [false, true]) {
      const outcome = observe(
        grammar.ast,
        input,
        wrapped,
        grammar.name.includes("metadata")
      )
      summary.comparisons++
      if (outcome.throws) summary.throws++
      else if (outcome.result.success) summary.success++
      else summary.failure++
      summary.fallbackRuns += outcome.events.filter(
        event => event === "fallback"
      ).length
      const { diagnostic, ...result } = outcome.result ?? {}
      const control = outcome.throws
        ? outcome
        : { result, events: outcome.events }
      controlHash.update(serialize({ input, wrapped, outcome: control }) + "\n")
      diagnosticHash.update(serialize({ input, wrapped, diagnostic }) + "\n")
    }
  return {
    id: grammar.id,
    controlHash: controlHash.digest("hex"),
    diagnosticHash: diagnosticHash.digest("hex")
  }
})
function hasMinimumRepetition(ast) {
  return (
    ast[0] === "many1" ||
    ast[0] === "atLeast" ||
    ast
      .slice(1)
      .some(child => Array.isArray(child) && hasMinimumRepetition(child))
  )
}
const baseline = {
  version: 2,
  corpusHash: createHash("sha256").update(serialize(grammars)).digest("hex"),
  seed: "0x12345678",
  inputs,
  summary,
  grammars: records
}
const args = process.argv.slice(2)
assert.ok(
  args.length === 0 ||
    (args.length === 1 && args[0] === "--approve-minimum-diagnostics"),
  "Usage: node scripts/control-regression.mjs [--approve-minimum-diagnostics]"
)
const approvalsFile = new URL("./control-diagnostics.json", import.meta.url)
const approving = args[0] === "--approve-minimum-diagnostics"
const expected = JSON.parse(await readFile(fixture, "utf8"))
assert.ok(
  serialize(expected.inputs) === serialize(inputs) &&
    expected.grammars.length === records.length &&
    expected.version === baseline.version &&
    expected.seed === baseline.seed &&
    expected.corpusHash === baseline.corpusHash &&
    serialize(expected.summary) === serialize(summary),
  "Control regression corpus/version/summary mismatch"
)
const overrides = new Map()
if (approving) {
  await assert.rejects(
    readFile(approvalsFile),
    { code: "ENOENT" },
    "Refusing to overwrite diagnostic approvals"
  )
} else {
  const approvals = JSON.parse(await readFile(approvalsFile, "utf8"))
  assert.equal(approvals.corpusHash, expected.corpusHash)
  assert.equal(approvals.diagnostics.length, 20)
  for (const entry of approvals.diagnostics) {
    const i = grammars.findIndex(grammar => grammar.id === entry.id)
    assert.ok(i >= 0, `Dangling diagnostic approval: ${entry.id}`)
    assert.ok(
      !overrides.has(entry.id),
      `Duplicate diagnostic approval: ${entry.id}`
    )
    assert.ok(
      hasMinimumRepetition(grammars[i].ast),
      `Not a minimum repetition: ${entry.id}`
    )
    assert.equal(expected.grammars[i].id, entry.id)
    assert.match(entry.newHash, /^[a-f0-9]{64}$/)
    assert.notEqual(entry.newHash, expected.grammars[i].diagnosticHash)
    assert.ok(typeof entry.reason === "string" && entry.reason.trim())
    overrides.set(entry.id, entry.newHash)
  }
}
const controlDifferences = []
const diagnosticDifferences = []
const minimumChanges = []
const usedOverrides = new Set()
records.forEach((record, i) => {
  const previous = expected.grammars[i]
  if (record.id !== previous.id || record.controlHash !== previous.controlHash)
    controlDifferences.push(i)
  const approvedHash = overrides.get(record.id)
  if (approvedHash) usedOverrides.add(record.id)
  if (record.diagnosticHash !== (approvedHash ?? previous.diagnosticHash)) {
    if (
      approving &&
      record.id === previous.id &&
      hasMinimumRepetition(grammars[i].ast)
    )
      minimumChanges.push({
        id: record.id,
        newHash: record.diagnosticHash,
        reason:
          "Unmet many1/atLeast minimum now preserves the stopping child failure span instead of synthesizing a zero-width minimum failure."
      })
    else diagnosticDifferences.push(i)
  }
})
assert.equal(usedOverrides.size, overrides.size, "Unused diagnostic approvals")
function report(label, differences, key) {
  console.log(`${label}: ${differences.length}`)
  for (const i of differences.slice(0, 10)) {
    const grammar = grammars[i]
    const expectedHash =
      key === "diagnosticHash"
        ? (overrides.get(grammar.id) ?? expected.grammars[i][key])
        : expected.grammars[i][key]
    console.log(
      `${grammar.id}: ${grammar.name}\nAST: ${JSON.stringify(grammar.ast)}\nexpected: ${expectedHash}\nactual:   ${records[i][key]}`
    )
  }
}
report("CONTROL mismatches", controlDifferences, "controlHash")
report("DIAGNOSTIC mismatches", diagnosticDifferences, "diagnosticHash")
if (controlDifferences.length || diagnosticDifferences.length) {
  console.error("Control regression mismatch")
  process.exitCode = 1
} else if (approving) {
  assert.equal(
    minimumChanges.length,
    20,
    "Expected exactly 20 minimum diagnostic changes"
  )
  await writeFile(
    approvalsFile,
    JSON.stringify(
      {
        sourceCommit: "6d5a4ff",
        originalBaselineCommit: "8c9bf25",
        corpusHash: expected.corpusHash,
        diagnostics: minimumChanges
      },
      null,
      2
    ) + "\n",
    { flag: "wx" }
  )
  console.log(`Approved minimum changes: ${minimumChanges.length}`)
} else {
  console.log(`Approved minimum changes: ${overrides.size}`)
  console.log("Control regression baseline and pinned diagnostics match")
}
console.log(JSON.stringify(summary, null, 2))
