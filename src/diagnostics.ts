/** Structured diagnostics and renderers. */
export { ParseError, SourceText, positionAt, spanAt } from "./errors.ts"
export type { Diagnostic, DiagnosticJson, Span } from "./errors.ts"
export { formatError } from "./error-formatter.ts"
export type { ErrorFormatterOptions } from "./error-formatter.ts"

export { generateHints, levenshteinDistance } from "./suggestions.ts"
