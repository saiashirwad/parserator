import { diagnosticMessage, type Diagnostic } from "./diagnostic.ts"
import { formatError, type ErrorFormatterOptions } from "./error-formatter.ts"
import { SourceText } from "./source-text.ts"
import { resolveHints } from "./suggestions.ts"

export type DiagnosticJson = Diagnostic & {
  readonly sourceName?: string
  readonly fatal: boolean
}

export function fatalMessage(message?: string): string {
  const detail = (message ?? "parse failed").replace(/^(?:Fatal:\s*)+/i, "")
  return `Fatal: ${detail}`
}

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
    this.diagnostic = resolveHints(diagnostic)
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
