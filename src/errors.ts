export type Span = {
  offset: number;
  length: number;
  line: number;
  column: number;
};

type ExpectedParseError = {
  tag: "Expected";
  span: Span;
  items: string[];
  context: string[];
  found?: string;
};

type UnexpectedParseError = {
  tag: "Unexpected";
  span: Span;
  found: string;
  context: string[];
  hints?: string[];
};

type CustomParseError = {
  tag: "Custom";
  span: Span;
  message: string;
  hints?: string[];
  context: string[];
};

type FatalParseError = {
  tag: "Fatal";
  span: Span;
  message: string;
  context: string[];
};

export type ParseError =
  | CustomParseError
  | ExpectedParseError
  | UnexpectedParseError
  | FatalParseError;

export const ParseError = {
  expected: (params: Omit<ExpectedParseError, "tag">): ExpectedParseError => ({
    tag: "Expected",
    ...params
  }),
  unexpected: (
    params: Omit<UnexpectedParseError, "tag">
  ): UnexpectedParseError => ({
    tag: "Unexpected",
    ...params
  }),
  custom: (params: Omit<CustomParseError, "tag">): CustomParseError => ({
    tag: "Custom",
    ...params
  }),
  fatal: (params: Omit<FatalParseError, "tag">): FatalParseError => ({
    tag: "Fatal",
    ...params
  })
};

export class ParseErrorBundle {
  constructor(
    public errors: ParseError[],
    public source: string
  ) {}

  get primary(): ParseError {
    return this.errors.reduce((furthest, current) =>
      current.span.offset > furthest.span.offset ? current : furthest
    );
  }

  get primaryErrors(): ParseError[] {
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
