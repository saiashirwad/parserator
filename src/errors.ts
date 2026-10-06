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
export type DiagnosticJson = Diagnostic & {
  readonly sourceName?: string
  readonly fatal: boolean
}

export type SourcePosition = {
  readonly line: number
  readonly column: number
  readonly offset: number
}

/** Source text shared by diagnostics and their renderers. */
export class SourceText {
  readonly text: string
  readonly name: string | undefined
  #lineStarts: number[] | undefined

  constructor(text: string, name?: string) {
    this.text = text
    this.name = name
  }

  charWidthAt(offset: number): number {
    const point = this.text.codePointAt(offset)
    return point === undefined ? 0 : point > 0xffff ? 2 : 1
  }

  charAt(offset: number): string {
    const point = this.text.codePointAt(offset)
    return point === undefined
      ? ""
      : point >= 0xd800 && point <= 0xdfff
        ? "\ufffd"
        : String.fromCodePoint(point)
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

export function fatalMessage(message?: string): string {
  const detail = (message ?? "parse failed").replace(/^(?:Fatal:\s*)+/i, "")
  return `Fatal: ${detail}`
}

/** The stable public parse error. */
export class ParseError extends Error {
  readonly diagnostic: Diagnostic
  readonly source: SourceText

  readonly fatal: boolean

  constructor(
    diagnostic: Diagnostic,
    source: SourceText | string,
    fatal = false
  ) {
    super(
      fatal
        ? fatalMessage(diagnosticMessage(diagnostic))
        : diagnosticMessage(diagnostic)
    )
    this.fatal = fatal
    this.name = "ParseError"
    this.diagnostic = diagnostic
    this.source = typeof source === "string" ? new SourceText(source) : source
  }

  format(options: ErrorFormatterOptions = {}): string {
    return formatError(this, options)
  }

  toJSON(): DiagnosticJson {
    return {
      ...this.diagnostic,
      fatal: this.fatal,
      ...(this.source.name ? { sourceName: this.source.name } : {})
    }
  }
}

import { formatError, type ErrorFormatterOptions } from "./error-formatter.ts"

export function positionAt(
  source: string,
  offset: number
): { line: number; column: number } {
  return new SourceText(source).positionAt(offset)
}

export function spanAt(start: number, end = start): Span {
  return { start, end }
}
