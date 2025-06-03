// import { describe, expect, test } from "bun:test";
// import { ErrorFormatter, formatError, type ErrorFormatterOptions } from "../src/error-formatter";
// import { type ParseErr, ParseErrorBundle, type Span } from "../src/errors";

// describe("error formatter", () => {
//   // Sample error data for testing
//   const span: Span = { offset: 8, length: 6, line: 2, column: 9 };
//   const multiLineSource = `function test() {
//   return functoin;
// }
// console.log("done");`;

//   const expectedError: ParseErr = {
//     tag: "Expected",
//     span,
//     items: ["identifier", "number"],
//     context: ["expression", "statement"]
//   };

//   const unexpectedError: ParseErr = {
//     tag: "Unexpected",
//     span,
//     found: "functoin",
//     context: ["function", "statement"]
//   };

//   const customErrorWithHints: ParseErr = {
//     tag: "Custom",
//     span,
//     message: "Invalid keyword",
//     hints: ["function", "return"],
//     context: ["declaration"]
//   };

//   describe("ErrorFormatter class", () => {
//     test("creates formatter with default options", () => {
//       const formatter = new ErrorFormatter();
//       expect(formatter).toBeInstanceOf(ErrorFormatter);
//     });

//     test("creates formatter with custom format", () => {
//       const formatter = new ErrorFormatter("ansi");
//       expect(formatter).toBeInstanceOf(ErrorFormatter);
//     });

//     test("creates formatter with custom options", () => {
//       const options: ErrorFormatterOptions = {
//         maxContextLines: 5,
//         showHints: false,
//         showContext: false
//       };
//       const formatter = new ErrorFormatter("plain", options);
//       expect(formatter).toBeInstanceOf(ErrorFormatter);
//     });

//     test("withOptions creates new formatter", () => {
//       const original = new ErrorFormatter("plain");
//       const modified = original.withOptions({ showHints: false });
//       expect(modified).not.toBe(original);
//     });

//     test("withFormat creates new formatter", () => {
//       const original = new ErrorFormatter("plain");
//       const modified = original.withFormat("ansi");
//       expect(modified).not.toBe(original);
//     });
//   });

//   describe("plain text formatting", () => {
//     const bundle = new ParseErrorBundle([expectedError], multiLineSource);
//     const formatter = new ErrorFormatter("plain");

//     test("formats basic error message", () => {
//       const result = formatter.format(bundle);

//       expect(result).toContain("Error at line 2, column 9");
//       expect(result).toContain("Expected: identifier or number");
//       expect(result).toContain("functoin");
//     });

//     test("includes pointer arrow", () => {
//       const result = formatter.format(bundle);
//       expect(result).toContain("^");
//     });

//     test("includes context stack", () => {
//       const result = formatter.format(bundle);
//       expect(result).toContain("Context: expression > statement");
//     });

//     test("formats unexpected error", () => {
//       const unexpectedBundle = new ParseErrorBundle([unexpectedError], multiLineSource);
//       const result = formatter.format(unexpectedBundle);

//       expect(result).toContain("Unexpected: functoin");
//     });

//     test("formats custom error with hints", () => {
//       const customBundle = new ParseErrorBundle([customErrorWithHints], multiLineSource);
//       const result = formatter.format(customBundle);

//       expect(result).toContain("Invalid keyword");
//       expect(result).toContain("Did you mean: function?");
//       expect(result).toContain("Did you mean: return?");
//     });

//     test("disables hints when showHints is false", () => {
//       const customBundle = new ParseErrorBundle([customErrorWithHints], multiLineSource);
//       const noHintsFormatter = new ErrorFormatter("plain", { showHints: false });
//       const result = noHintsFormatter.format(customBundle);

//       expect(result).not.toContain("Did you mean");
//     });

//     test("disables context when showContext is false", () => {
//       const noContextFormatter = new ErrorFormatter("plain", { showContext: false });
//       const result = noContextFormatter.format(bundle);

//       expect(result).not.toContain("Context:");
//     });
//   });

//   describe("ANSI formatting", () => {
//     const bundle = new ParseErrorBundle([expectedError], multiLineSource);
//     const formatter = new ErrorFormatter("ansi");

//     test("includes ANSI color codes", () => {
//       const result = formatter.format(bundle);

//       expect(result).toContain("\x1b[31m"); // Red
//       expect(result).toContain("\x1b[0m"); // Reset
//     });

//     test("formats hints with cyan color", () => {
//       const customBundle = new ParseErrorBundle([customErrorWithHints], multiLineSource);
//       const result = formatter.format(customBundle);

//       expect(result).toContain("\x1b[36m"); // Cyan for hints
//     });

//     test("formats context with gray color", () => {
//       const result = formatter.format(bundle);

//       expect(result).toContain("\x1b[90m"); // Gray for context
//     });

//     test("includes colored pointer", () => {
//       const result = formatter.format(bundle);
//       // Should have red caret(s) - might be multiple based on span length
//       expect(result).toContain("\x1b[31m");
//       expect(result).toContain("\x1b[0m");
//       expect(result).toContain("^");
//     });
//   });

//   describe("HTML formatting", () => {
//     const bundle = new ParseErrorBundle([expectedError], multiLineSource);
//     const formatter = new ErrorFormatter("html");

//     test("wraps in HTML structure", () => {
//       const result = formatter.format(bundle);

//       expect(result).toContain('<div class="parse-error">');
//       expect(result).toContain("</div>");
//     });

//     test("includes proper CSS classes", () => {
//       const result = formatter.format(bundle);

//       expect(result).toContain('class="error-header"');
//       expect(result).toContain('class="error-context"');
//       expect(result).toContain('class="error-message"');
//     });

//     test("escapes HTML entities", () => {
//       const htmlSource = 'if (x < 5 && y > "test") {';
//       const htmlError: ParseErr = {
//         tag: "Unexpected",
//         span: { offset: 4, length: 1, line: 1, column: 5 },
//         found: "<script>",
//         context: []
//       };
//       const htmlBundle = new ParseErrorBundle([htmlError], htmlSource);
//       const result = formatter.format(htmlBundle);

//       expect(result).toContain("&lt;");
//       expect(result).toContain("&gt;");
//       expect(result).not.toContain("<script>");
//     });

//     test("formats hints with proper HTML", () => {
//       const customBundle = new ParseErrorBundle([customErrorWithHints], multiLineSource);
//       const result = formatter.format(customBundle);

//       expect(result).toContain('class="error-hints"');
//       expect(result).toContain('class="suggestion"');
//     });

//     test("formats context stack with proper HTML", () => {
//       const result = formatter.format(bundle);

//       expect(result).toContain('class="context-item"');
//       expect(result).toContain("&gt;"); // HTML encoded >
//     });
//   });

//   describe("JSON formatting", () => {
//     const bundle = new ParseErrorBundle([expectedError], multiLineSource);
//     const formatter = new ErrorFormatter("json");

//     test("produces valid JSON", () => {
//       const result = formatter.format(bundle);
//       expect(() => JSON.parse(result)).not.toThrow();
//     });

//     test("includes error location", () => {
//       const result = formatter.format(bundle);
//       const parsed = JSON.parse(result);

//       expect(parsed.error.location.line).toBe(2);
//       expect(parsed.error.location.column).toBe(9);
//       expect(parsed.error.location.offset).toBe(8);
//     });

//     test("includes context information", () => {
//       const result = formatter.format(bundle);
//       const parsed = JSON.parse(result);

//       expect(parsed.error.context.stack).toEqual(["expression", "statement"]);
//       expect(parsed.error.context.lines).toBeInstanceOf(Array);
//     });

//     test("includes all errors", () => {
//       const multiErrorBundle = new ParseErrorBundle(
//         [expectedError, unexpectedError, customErrorWithHints],
//         multiLineSource
//       );
//       const result = formatter.format(multiErrorBundle);
//       const parsed = JSON.parse(result);

//       expect(parsed.allErrors).toHaveLength(3);
//       expect(parsed.allErrors[0].type).toBe("Expected");
//       expect(parsed.allErrors[1].type).toBe("Unexpected");
//       expect(parsed.allErrors[2].type).toBe("Custom");
//     });

//     test("includes hints for custom errors", () => {
//       const customBundle = new ParseErrorBundle([customErrorWithHints], multiLineSource);
//       const result = formatter.format(customBundle);
//       const parsed = JSON.parse(result);

//       expect(parsed.error.hints).toEqual(["function", "return"]);
//     });

//     test("respects tabSize option", () => {
//       const customFormatter = new ErrorFormatter("json", { tabSize: 4 });
//       const result = customFormatter.format(bundle);

//       // Should be formatted with 4 spaces
//       expect(result).toContain('    "error":');
//     });
//   });

//   describe("context lines handling", () => {
//     const longSource = `line 1
// line 2
// line 3
// ERROR LINE HERE
// line 5
// line 6
// line 7`;

//     const errorInMiddle: ParseErr = {
//       tag: "Unexpected",
//       span: { offset: 21, length: 5, line: 4, column: 1 },
//       found: "ERROR",
//       context: []
//     };

//     const bundle = new ParseErrorBundle([errorInMiddle], longSource);

//     test("shows context lines around error", () => {
//       const formatter = new ErrorFormatter("plain", { maxContextLines: 3 });
//       const result = formatter.format(bundle);

//       expect(result).toContain("line 3");
//       expect(result).toContain("ERROR LINE HERE");
//       expect(result).toContain("line 5");
//     });

//     test("limits context lines", () => {
//       const formatter = new ErrorFormatter("plain", { maxContextLines: 1 });
//       const result = formatter.format(bundle);

//       expect(result).toContain("ERROR LINE HERE");
//       expect(result).not.toContain("line 2");
//       expect(result).not.toContain("line 6");
//     });

//     test("handles errors at beginning of file", () => {
//       const earlyError: ParseErr = {
//         tag: "Unexpected",
//         span: { offset: 0, length: 4, line: 1, column: 1 },
//         found: "line",
//         context: []
//       };
//       const earlyBundle = new ParseErrorBundle([earlyError], longSource);
//       const result = new ErrorFormatter("plain").format(earlyBundle);

//       expect(result).toContain("line 1");
//     });

//     test("handles errors at end of file", () => {
//       const lateError: ParseErr = {
//         tag: "Unexpected",
//         span: { offset: 50, length: 4, line: 7, column: 1 },
//         found: "line",
//         context: []
//       };
//       const lateBundle = new ParseErrorBundle([lateError], longSource);
//       const result = new ErrorFormatter("plain").format(lateBundle);

//       expect(result).toContain("line 7");
//     });
//   });

//   describe("convenience functions", () => {
//     const bundle = new ParseErrorBundle([expectedError], multiLineSource);

//     test("formatError.plain", () => {
//       const result = formatError.plain(bundle);
//       expect(result).toContain("Error at line 2");
//       expect(result).not.toContain("\x1b["); // No ANSI codes
//     });

//     test("formatError.ansi", () => {
//       const result = formatError.ansi(bundle);
//       expect(result).toContain("\x1b[31m"); // ANSI colors
//     });

//     test("formatError.html", () => {
//       const result = formatError.html(bundle);
//       expect(result).toContain('<div class="parse-error">');
//     });

//     test("formatError.json", () => {
//       const result = formatError.json(bundle);
//       expect(() => JSON.parse(result)).not.toThrow();
//     });

//     test("convenience functions accept options", () => {
//       const result = formatError.plain(bundle, { showHints: false });
//       expect(result).not.toContain("Did you mean");
//     });
//   });

//   describe("edge cases", () => {
//     test("handles empty source", () => {
//       const emptyError: ParseErr = {
//         tag: "Unexpected",
//         span: { offset: 0, length: 0, line: 1, column: 1 },
//         found: "end of input",
//         context: []
//       };
//       const emptyBundle = new ParseErrorBundle([emptyError], "");
//       const result = new ErrorFormatter("plain").format(emptyBundle);

//       expect(result).toContain("Error at line 1");
//     });

//     test("handles single line source", () => {
//       const singleLineError: ParseErr = {
//         tag: "Expected",
//         span: { offset: 5, length: 1, line: 1, column: 6 },
//         items: ["semicolon"],
//         context: []
//       };
//       const singleLineBundle = new ParseErrorBundle([singleLineError], "const x = 5");
//       const result = new ErrorFormatter("plain").format(singleLineBundle);

//       expect(result).toContain("const x = 5");
//     });

//     test("handles very long lines", () => {
//       const longLine = "x".repeat(200);
//       const longLineError: ParseErr = {
//         tag: "Unexpected",
//         span: { offset: 100, length: 1, line: 1, column: 101 },
//         found: "x",
//         context: []
//       };
//       const longLineBundle = new ParseErrorBundle([longLineError], longLine);
//       const result = new ErrorFormatter("plain").format(longLineBundle);

//       expect(result).toContain("x".repeat(100));
//     });

//     test("handles zero-length spans", () => {
//       const zeroLengthError: ParseErr = {
//         tag: "Expected",
//         span: { offset: 5, length: 0, line: 1, column: 6 },
//         items: ["semicolon"],
//         context: []
//       };
//       const bundle = new ParseErrorBundle([zeroLengthError], "const x = 5");
//       const result = new ErrorFormatter("plain").format(bundle);

//       expect(result).toContain("^"); // Should still show pointer
//     });
//   });
// });
