/** A half-open span: UTF-16 offsets for text, byte offsets for binary input. */
export type Span = { readonly start: number; readonly end: number }

export type Diagnostic = {
  readonly kind: "expected" | "unexpected" | "custom" | "fatal"
  readonly span: Span
  readonly expected?: readonly string[]
  readonly found?: string
  readonly message?: string
  readonly context?: readonly string[]
  readonly hints?: readonly string[]
}
export type DiagnosticJson = Diagnostic & { readonly sourceName?: string }

/** Source text shared by diagnostics and their renderers. */
export class SourceText {
  readonly text: string
  readonly name: string | undefined
  #lineStarts: number[] | undefined

  constructor(text: string, name?: string) {
    this.text = text
    this.name = name
  }

  private lineStarts(): number[] {
    if (this.#lineStarts) return this.#lineStarts
    const starts = [0]
    for (let i = 0; i < this.text.length; i++) {
      const c = this.text.charCodeAt(i)
      if (c === 13) {
        if (this.text.charCodeAt(i + 1) === 10) i++
        starts.push(i + 1)
      } else if (c === 10) starts.push(i + 1)
    }
    this.#lineStarts = starts
    return starts
  }

  get lineCount(): number {
    return this.lineStarts().length
  }

  positionAt(offset: number): { line: number; column: number } {
    const starts = this.lineStarts()
    const bounded = Math.max(0, Math.min(offset, this.text.length))
    let low = 0
    let high = starts.length
    while (low + 1 < high) {
      const mid = (low + high) >>> 1
      if (starts[mid]! <= bounded) low = mid
      else high = mid
    }
    return { line: low + 1, column: bounded - starts[low]! + 1 }
  }

  lineAt(line: number): string {
    const starts = this.lineStarts()
    const index = Math.max(1, Math.min(line, starts.length)) - 1
    const start = starts[index]!
    const end = starts[index + 1] ?? this.text.length
    return this.text.slice(start, end).replace(/\r?\n$|\r$/, "")
  }
}

export function diagnosticMessage(diagnostic: Diagnostic): string {
  if (diagnostic.kind === "fatal") return fatalMessage(diagnostic.message)
  if (diagnostic.message) return diagnostic.message
  if (diagnostic.kind === "expected") {
    const expected = diagnostic.expected?.join(" or ") || "valid input"
    return `Expected ${expected}${diagnostic.found ? `, found ${diagnostic.found}` : ""}`
  }
  return diagnostic.found
    ? `Unexpected ${diagnostic.found}`
    : "Unexpected input"
}

export function fatalMessage(message?: string): string {
  const detail = (message ?? "parse failed").replace(/^(?:Fatal:\s*)+/i, "")
  return `Fatal: ${detail}`
}

/** Shared by every input kind's parse error; each adds its own renderer. */
export abstract class DiagnosticError<
  S extends { readonly name: string | undefined },
  D extends Diagnostic = Diagnostic
> extends Error {
  readonly diagnostic: D
  readonly source: S

  /** Build an error message while retaining the structured diagnostic and source. */
  constructor(diagnostic: D, source: S) {
    super(diagnosticMessage(diagnostic))
    this.diagnostic = diagnostic
    this.source = source
  }

  /** Serialize the structured diagnostic and optional source display name. */
  toJSON(): D & { readonly sourceName?: string } {
    return {
      ...this.diagnostic,
      ...(this.source.name ? { sourceName: this.source.name } : {})
    }
  }
}

/** The stable public parse error. */
export class ParseError extends DiagnosticError<SourceText> {
  /** Normalize a text source and attach its diagnostic to a parse error. */
  constructor(diagnostic: Diagnostic, source: SourceText | string) {
    super(
      diagnostic,
      typeof source === "string" ? new SourceText(source) : source
    )
    this.name = "ParseError"
  }

  format(
    options: {
      style?: "plain" | "ansi"
      contextLines?: number
      showHints?: boolean
    } = {}
  ): string {
    // The formatter imports this class for its input type; the import is safe
    // because no formatter code runs while this module is being initialized.
    return new ErrorFormatter(options).format(this)
  }
}

import { ErrorFormatter } from "./error-formatter.ts"

export type FailureControl =
  | { readonly kind: "recoverable"; readonly cutGeneration: number }
  | { readonly kind: "fatal" }

export type Failure = {
  readonly diagnostic: Diagnostic
  readonly control: FailureControl
}

export function positionAt(
  source: string,
  offset: number
): { line: number; column: number } {
  return new SourceText(source).positionAt(offset)
}

export function spanAt(start: number, end = start): Span {
  return { start, end }
}
