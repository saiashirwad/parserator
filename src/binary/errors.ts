import { DiagnosticError, type Diagnostic, type Span } from "../errors.ts"

/** Byte spans, plus a precise bit span when the failure came from a bit grammar. */
export type BinaryDiagnostic = Diagnostic & {
  /** Half-open span in absolute bit offsets, set by failures inside `bitFields`. */
  readonly bitSpan?: Span
}
export type BinaryDiagnosticJson = BinaryDiagnostic & {
  readonly unit: "byte"
  readonly sourceName?: string
}

/** Format a byte as two lowercase hexadecimal digits. */
export const hexByte = (value: number): string =>
  value.toString(16).padStart(2, "0")

/**
 * Decodes hex text such as "ca fe 01" into bytes. Whitespace is ignored;
 * anything else, including an odd trailing digit, throws.
 */
export function hex(text: string): Uint8Array {
  const clean = text.replace(/\s+/g, "")
  if (!/^(?:[0-9a-f]{2})*$/i.test(clean)) {
    throw new Error(
      `hex: expected pairs of hex digits, got ${JSON.stringify(text)}`
    )
  }
  return Uint8Array.from(clean.matchAll(/../g), ([pair]) => parseInt(pair, 16))
}

export class SourceBytes {
  readonly bytes: Uint8Array
  readonly name: string | undefined

  /** Retain the input view and its optional diagnostic display name. */
  constructor(bytes: Uint8Array, name?: string) {
    this.bytes = bytes
    this.name = name
  }
}

/** Renders byte and bit positions over a hex row of the failing bytes. */
export class BinaryParseError extends DiagnosticError<
  SourceBytes,
  BinaryDiagnostic
> {
  /** Associate a binary diagnostic with the bytes that produced it. */
  constructor(diagnostic: BinaryDiagnostic, source: SourceBytes) {
    super(diagnostic, source)
    this.name = "BinaryParseError"
  }

  /** Render the failing hex row, span marker, context, and hints. */
  format(): string {
    const { diagnostic, source } = this
    const offset = diagnostic.span.start
    const bit = diagnostic.bitSpan
      ? `, bit ${diagnostic.bitSpan.start % 8}`
      : ""
    const location = `${source.name ? `${source.name}: ` : ""}byte ${offset}${bit}`
    const start = Math.max(0, Math.floor(offset / 16) * 16)
    const row = Array.from(
      source.bytes.subarray(start, start + 16),
      hexByte
    ).join(" ")
    const label = start.toString(16).padStart(8, "0")
    const covered = Math.min(diagnostic.span.end, start + 16) - offset
    const carets = "^".repeat(Math.max(1, covered * 3 - 1))
    const marker = " ".repeat(label.length + 2 + (offset - start) * 3) + carets
    const context = diagnostic.context?.length
      ? `\nwhile parsing ${[...diagnostic.context].reverse().join(" > ")}`
      : ""
    const hints =
      diagnostic.hints?.map(hint => `\nhint: ${hint}`).join("") ?? ""
    return `${location}: ${this.message}\n${label}  ${row}\n${marker}${context}${hints}`
  }

  /** Serialize the diagnostic with explicit byte units and any source name. */
  override toJSON(): BinaryDiagnosticJson {
    return { ...super.toJSON(), unit: "byte" }
  }
}
