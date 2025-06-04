export type Span = { offset: number; length: number; line: number; column: number };

type ExpectedParseErr = {
  tag: "Expected";
  span: Span;
  items: string[];
  context: string[];
};
type UnexpectedParseErr = {
  tag: "Unexpected";
  span: Span;
  found: string;
  context: string[];
  hints?: string[];
};
type CustomParseErr = {
  tag: "Custom";
  span: Span;
  message: string;
  hints?: string[];
  context: string[];
};
type FatalParseErr = {
  tag: "Fatal";
  span: Span;
  message: string;
  context: string[];
};

export type ParseErr = ExpectedParseErr | UnexpectedParseErr | CustomParseErr | FatalParseErr;

export class ParseErrorBundle {
  constructor(
    public errors: ParseErr[],
    public source: string
  ) {}

  // Get the primary error (furthest right)
  get primary(): ParseErr {
    return this.errors.reduce((furthest, current) =>
      current.span.offset > furthest.span.offset ? current : furthest
    );
  }

  // Get all errors at the same furthest offset
  get primaryErrors(): ParseErr[] {
    const maxOffset = this.primary.span.offset;
    return this.errors.filter(err => err.span.offset === maxOffset);
  }
}

// Helper function to create a span from parser state
export function createSpan(
  state: { pos: { offset: number; line: number; column: number } },
  length: number = 0
): Span {
  return { offset: state.pos.offset, length, line: state.pos.line, column: state.pos.column };
}
