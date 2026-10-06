import type { Diagnostic } from "./errors.ts"

export function mergeDiagnostics(
  diagnostics: readonly [Diagnostic, ...Diagnostic[]]
): Diagnostic {
  const furthest = Math.max(...diagnostics.map(d => d.span.start))
  const tied = diagnostics.filter(d => d.span.start === furthest)
  const custom = tied.filter(
    d => d.kind === "custom" || d.message !== undefined
  )
  const expected = tied.filter(d => d.kind === "expected")
  const candidates = custom.length ? custom : expected.length ? expected : tied
  const base = candidates.reduce((best, candidate) =>
    (candidate.context?.length ?? 0) > (best.context?.length ?? 0)
      ? candidate
      : best
  )
  const hints = [...new Set(tied.flatMap(d => d.hints ?? []))]
  const diagnostic: Diagnostic =
    !custom.length && expected.length
      ? {
          ...base,
          kind: "expected",
          span: {
            start: furthest,
            end: Math.max(furthest, ...expected.map(d => d.span.end))
          },
          expected: [...new Set(expected.flatMap(d => d.expected))]
        }
      : base
  return hints.length ? { ...diagnostic, hints } : diagnostic
}
