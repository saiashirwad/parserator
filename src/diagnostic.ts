/** A half-open span into a JavaScript string (UTF-16 code-unit offsets). */
export type Span = { readonly start: number; readonly end: number }

type DiagnosticDetails = {
  readonly span: Span
  readonly found?: string
  readonly context?: readonly string[]
  readonly hints?: readonly string[]
}

export type Diagnostic = DiagnosticDetails &
  (
    | {
        readonly kind: "expected"
        readonly expected: readonly [string, ...string[]]
      }
    | { readonly kind: "unexpected"; readonly found: string }
    | { readonly kind: "custom"; readonly message: string }
  )

export function diagnosticMessage(diagnostic: Diagnostic): string {
  switch (diagnostic.kind) {
    case "custom":
      return diagnostic.message
    case "expected":
      return `Expected ${diagnostic.expected.join(" or ")}${diagnostic.found ? `, found ${diagnostic.found}` : ""}`
    case "unexpected":
      return diagnostic.found
        ? `Unexpected ${diagnostic.found}`
        : "Unexpected input"
  }
}

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

export function spanAt(start: number, end = start): Span {
  return { start, end }
}
