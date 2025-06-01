export type Span = {
  offset: number
  length: number
  line: number
  column: number
}

export type ParseErr =
  | { tag: "Expected"; span: Span; items: string[]; context: string[] }
  | {
      tag: "Unexpected"
      span: Span
      found: string
      context: string[]
      hints?: string[]
    }
  | {
      tag: "Custom"
      span: Span
      message: string
      hints?: string[]
      context: string[]
    }

export class ParseErrorBundle {
  constructor(
    public errors: ParseErr[],
    public source: string
  ) {}

  // Get the primary error (furthest right)
  get primary(): ParseErr {
    return this.errors.reduce((furthest, current) =>
      current.span.offset > furthest.span.offset ? current : furthest
    )
  }

  // Get all errors at the same furthest offset
  get primaryErrors(): ParseErr[] {
    const maxOffset = this.primary.span.offset
    return this.errors.filter(err => err.span.offset === maxOffset)
  }
}

// Helper function to create a span from parser state
export function createSpan(
  state: { pos: { offset: number; line: number; column: number } },
  length: number = 0
): Span {
  return {
    offset: state.pos.offset,
    length,
    line: state.pos.line,
    column: state.pos.column
  }
}

// Adapter to maintain backwards compatibility with existing ParserError
import { ParserError } from "./state"

export function legacyError(bundle: ParseErrorBundle): ParserError {
  const primary = bundle.primary
  return new ParserError(
    primary.tag === "Custom" ?
      primary.message
    : `${primary.tag}: ${JSON.stringify(primary)}`,
    primary.tag === "Expected" ? primary.items : [],
    primary.tag === "Unexpected" ? primary.found : undefined
  )
}
