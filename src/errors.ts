export type Span = {
  offset: number;
  length: number;
  line: number;
  column: number;
};

type ExpectedParseErr = {
  tag: "Expected";
  span: Span;
  items: string[];
  context: string[];
  found?: string; // ADD: What was actually found
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

export type ParseErr =
  | ExpectedParseErr
  | UnexpectedParseErr
  | CustomParseErr
  | FatalParseErr;

export class ParseErrorBundle {
  constructor(
    public errors: ParseErr[],
    public source: string
  ) {}

  get primary(): ParseErr {
    return this.errors.reduce((furthest, current) =>
      current.span.offset > furthest.span.offset ? current : furthest
    );
  }

  get primaryErrors(): ParseErr[] {
    const maxOffset = this.primary.span.offset;
    return this.errors.filter(err => err.span.offset === maxOffset);
  }

  toString(): string {
    const err = this.primary;
    switch (err.tag) {
      case "Expected":
        return `Expected ${err.items.join(" or ")}${err.found ? `, found ${err.found}` : ""}`;
      case "Unexpected":
        return `Unexpected ${err.found}`;
      case "Custom":
        return err.message;
      case "Fatal":
        return `Fatal: ${err.message}`;
    }
  }

  format(format: "plain" | "ansi" | "html" | "json" = "plain"): string {
    const { ErrorFormatter } = require("./error-formatter");
    return new ErrorFormatter(format).format(this);
  }
}

export function createSpan(
  state: { pos: { offset: number; line: number; column: number } },
  length: number = 0
): Span {
  return {
    offset: state.pos.offset,
    length,
    line: state.pos.line,
    column: state.pos.column
  };
}
