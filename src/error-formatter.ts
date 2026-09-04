import { fatalMessage, type Diagnostic, type ParseError } from "./errors.ts"

export type ErrorFormatterOptions = {
  style?: "plain" | "ansi"
  contextLines?: number
  showHints?: boolean
}

/** Renders a ParseError for terminals or logs. */
export class ErrorFormatter {
  readonly options: Required<ErrorFormatterOptions>

  constructor(options: ErrorFormatterOptions = {}) {
    this.options = {
      style: options.style ?? "plain",
      contextLines: options.contextLines ?? 2,
      showHints: options.showHints ?? true
    }
  }

  format(error: ParseError): string {
    const d = error.diagnostic
    const pos = error.source.positionAt(d.span.start)
    const lines: string[] = []
    const prefix = error.source.name ? `${error.source.name}:` : ""
    lines.push(`${prefix}line ${pos.line}, column ${pos.column}:`)
    const radius = Math.max(0, this.options.contextLines)
    const first = Math.max(1, pos.line - radius)
    const last = Math.min(this.lineCount(error), pos.line + radius)
    const width = String(last).length
    for (let line = first; line <= last; line++) {
      const marker = line === pos.line ? ">" : " "
      lines.push(
        `${marker} ${String(line).padStart(width, " ")} | ${error.source.lineAt(line)}`
      )
      if (line === pos.line) {
        const column = Math.max(0, pos.column - 1)
        lines.push(`  ${" ".repeat(width)} | ${" ".repeat(column)}^`)
      }
    }
    lines.push(formatDiagnostic(d))
    if (this.options.showHints && d.hints?.length) {
      lines.push(`Did you mean: ${d.hints.join(", ")}?`)
    }
    const context = d.context?.filter(Boolean)
    if (context?.length) lines.push(`While parsing: ${context.join(" > ")}`)
    const plain = lines.join("\n")
    if (this.options.style !== "ansi") return plain
    return plain.replace(/^([^\n]*):$/m, "\x1b[31m$1\x1b[0m:")
  }

  private lineCount(error: ParseError): number {
    let count = 1
    for (let i = 0; i < error.source.text.length; i++) {
      const c = error.source.text[i]
      if (c === "\r") {
        if (error.source.text[i + 1] === "\n") i++
        count++
      } else if (c === "\n") count++
    }
    return count
  }
}

function formatDiagnostic(d: Diagnostic): string {
  if (d.kind === "fatal") return fatalMessage(d.message)
  if (d.message) return d.message
  if (d.kind === "expected")
    return `Expected ${d.expected?.join(" or ") || "valid input"}${d.found ? `, found ${d.found}` : ""}`
  return d.found ? `Unexpected ${d.found}` : "Unexpected input"
}

export function formatError(
  error: ParseError,
  options: ErrorFormatterOptions = {}
): string {
  return new ErrorFormatter(options).format(error)
}
