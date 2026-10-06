import type { Diagnostic } from "./errors.ts"

export function mergeDiagnostics(
  diagnostics: readonly [Diagnostic, ...Diagnostic[]]
): Diagnostic {
  const furthest = Math.max(...diagnostics.map(d => d.span.start))
  const tied = diagnostics.filter(d => d.span.start === furthest)
  const custom = tied.filter(d => d.kind === "custom")
  const unexpected = tied.filter(d => d.kind === "unexpected")
  const expected = tied.filter(d => d.kind === "expected")
  const candidates = custom.length
    ? custom
    : unexpected.length
      ? unexpected
      : expected
  const base = candidates.reduce((best, candidate) =>
    (candidate.context?.length ?? 0) > (best.context?.length ?? 0)
      ? candidate
      : best
  )
  const hints = [...new Set(tied.flatMap(d => d.hints ?? []))]
  let diagnostic = base
  if (!custom.length && base.kind === "expected") {
    const first = base.expected[0]
    const items = [...new Set(expected.flatMap(d => d.expected))]
    const head = items.shift() ?? first
    diagnostic = {
      ...base,
      span: {
        start: furthest,
        end: Math.max(furthest, ...expected.map(d => d.span.end))
      },
      expected: [head, ...items]
    }
  }
  return hints.length ? { ...diagnostic, hints } : diagnostic
}
