import { diagnosticMessage, type ParseError } from "./errors.ts"

export type ErrorFormatterOptions = {
  style?: "plain" | "ansi"
  contextLines?: number
  showHints?: boolean
}

export function formatError(
  error: ParseError,
  options: ErrorFormatterOptions = {}
): string {
  const d = error.diagnostic
  const pos = error.source.positionAt(d.span.start)
  const lines: string[] = []
  const prefix = error.source.name ? `${error.source.name}:` : ""
  lines.push(`${prefix}line ${pos.line}, column ${pos.column}:`)
  const radius = Math.max(0, options.contextLines ?? 2)
  const first = Math.max(1, pos.line - radius)
  const last = Math.min(error.source.lineCount, pos.line + radius)
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
  lines.push(diagnosticMessage(d))
  if ((options.showHints ?? true) && d.hints?.length) {
    lines.push(`Did you mean: ${d.hints.join(", ")}?`)
  }
  const context = d.context?.filter(Boolean)
  if (context?.length) lines.push(`While parsing: ${context.join(" > ")}`)
  const plain = lines.join("\n")
  if (options.style !== "ansi") return plain
  return plain.replace(/^([^\n]*):$/m, "\x1b[31m$1\x1b[0m:")
}
