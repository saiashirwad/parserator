import { expect, test } from "vitest"
import { formatError } from "../src/diagnostics.ts"
import {
  ParseError,
  SourceText,
  type ErrorFormatterOptions
} from "../src/index.ts"

test("the pure formatter and ParseError.format share rendering options", () => {
  const error = new ParseError(
    {
      kind: "expected",
      span: { start: 2, end: 3 },
      expected: ["x"],
      found: "b",
      hints: ["x"],
      context: ["expression"]
    },
    new SourceText("a\nb\nc", "input")
  )
  expect(formatError(error)).toBe(
    "input:line 2, column 1:\n  1 | a\n> 2 | b\n    | ^\n  3 | c\nExpected x, found b\nDid you mean: x?\nWhile parsing: expression"
  )
  const options: ErrorFormatterOptions = {
    style: "ansi",
    contextLines: 0,
    showHints: false
  }
  expect(error.format(options)).toBe(formatError(error, options))
  expect(formatError(error, options)).toBe(
    "\x1b[31minput:line 2, column 1\x1b[0m:\n> 2 | b\n    | ^\nExpected x, found b\nWhile parsing: expression"
  )
})
