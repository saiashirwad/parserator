// import { describe, expect, test } from "bun:test"
// import {
//   type ParseErr,
//   ParseErrorBundle,
//   type Span,
//   createSpan
// } from "../src/rich-errors"
// import { ParserError } from "../src/state"

// describe("rich-errors", () => {
//   describe("createSpan", () => {
//     test("creates span with basic position", () => {
//       const state = {
//         pos: { offset: 10, line: 2, column: 5 }
//       }
//       const span = createSpan(state)

//       expect(span).toEqual({
//         offset: 10,
//         length: 0,
//         line: 2,
//         column: 5
//       })
//     })

//     test("creates span with custom length", () => {
//       const state = {
//         pos: { offset: 15, line: 3, column: 8 }
//       }
//       const span = createSpan(state, 5)

//       expect(span).toEqual({
//         offset: 15,
//         length: 5,
//         line: 3,
//         column: 8
//       })
//     })
//   })

//   describe("ParseErr types", () => {
//     test("creates Expected error", () => {
//       const span: Span = { offset: 0, length: 1, line: 1, column: 1 }
//       const error: ParseErr = {
//         tag: "Expected",
//         span,
//         items: ["identifier", "number"],
//         context: ["expression", "term"]
//       }

//       expect(error.tag).toBe("Expected")
//       expect(error.items).toEqual(["identifier", "number"])
//       expect(error.context).toEqual(["expression", "term"])
//     })

//     test("creates Unexpected error", () => {
//       const span: Span = { offset: 5, length: 1, line: 1, column: 6 }
//       const error: ParseErr = {
//         tag: "Unexpected",
//         span,
//         found: ";",
//         context: ["statement"]
//       }

//       expect(error.tag).toBe("Unexpected")
//       expect(error.found).toBe(";")
//       expect(error.context).toEqual(["statement"])
//     })

//     test("creates Custom error without hints", () => {
//       const span: Span = { offset: 10, length: 3, line: 2, column: 1 }
//       const error: ParseErr = {
//         tag: "Custom",
//         span,
//         message: "Invalid syntax",
//         context: ["block"]
//       }

//       expect(error.tag).toBe("Custom")
//       expect(error.message).toBe("Invalid syntax")
//       expect(error.hints).toBeUndefined()
//       expect(error.context).toEqual(["block"])
//     })

//     test("creates Custom error with hints", () => {
//       const span: Span = { offset: 20, length: 6, line: 3, column: 5 }
//       const error: ParseErr = {
//         tag: "Custom",
//         span,
//         message: "Unknown keyword",
//         hints: ["lambda", "let"],
//         context: ["expression"]
//       }

//       expect(error.tag).toBe("Custom")
//       expect(error.message).toBe("Unknown keyword")
//       expect(error.hints).toEqual(["lambda", "let"])
//       expect(error.context).toEqual(["expression"])
//     })
//   })

//   describe("ParseErrorBundle", () => {
//     const source = "hello world"

//     test("single error bundle", () => {
//       const error: ParseErr = {
//         tag: "Expected",
//         span: { offset: 5, length: 1, line: 1, column: 6 },
//         items: ["space"],
//         context: []
//       }
//       const bundle = new ParseErrorBundle([error], source)

//       expect(bundle.errors).toHaveLength(1)
//       expect(bundle.primary).toBe(error)
//       expect(bundle.primaryErrors).toEqual([error])
//     })

//     test("multiple errors - primary is furthest", () => {
//       const error1: ParseErr = {
//         tag: "Expected",
//         span: { offset: 2, length: 1, line: 1, column: 3 },
//         items: ["letter"],
//         context: []
//       }
//       const error2: ParseErr = {
//         tag: "Unexpected",
//         span: { offset: 8, length: 1, line: 1, column: 9 },
//         found: "d",
//         context: []
//       }
//       const error3: ParseErr = {
//         tag: "Custom",
//         span: { offset: 5, length: 1, line: 1, column: 6 },
//         message: "Custom error",
//         context: []
//       }

//       const bundle = new ParseErrorBundle([error1, error2, error3], source)

//       expect(bundle.errors).toHaveLength(3)
//       expect(bundle.primary).toBe(error2) // furthest offset (8)
//       expect(bundle.primaryErrors).toEqual([error2])
//     })

//     test("multiple errors at same furthest offset", () => {
//       const error1: ParseErr = {
//         tag: "Expected",
//         span: { offset: 5, length: 1, line: 1, column: 6 },
//         items: ["space"],
//         context: []
//       }
//       const error2: ParseErr = {
//         tag: "Expected",
//         span: { offset: 10, length: 1, line: 1, column: 11 },
//         items: ["punctuation"],
//         context: []
//       }
//       const error3: ParseErr = {
//         tag: "Unexpected",
//         span: { offset: 10, length: 1, line: 1, column: 11 },
//         found: "d",
//         context: []
//       }

//       const bundle = new ParseErrorBundle([error1, error2, error3], source)

//       expect(bundle.primary).toBe(error2) // first one at furthest offset
//       expect(bundle.primaryErrors).toEqual([error2, error3]) // both at offset 10
//     })

//     test("empty errors array throws", () => {
//       expect(() => new ParseErrorBundle([], source).primary).toThrow()
//     })
//   })

//   describe("legacyError adapter", () => {
//     const source = "test input"

//     test("converts Expected error", () => {
//       const error: ParseErr = {
//         tag: "Expected",
//         span: { offset: 0, length: 1, line: 1, column: 1 },
//         items: ["identifier", "number"],
//         context: ["expression"]
//       }
//       const bundle = new ParseErrorBundle([error], source)
//       const legacy = legacyError(bundle)

//       expect(legacy).toBeInstanceOf(ParserError)
//       expect(legacy.message).toBe(
//         'Expected: {"tag":"Expected","span":{"offset":0,"length":1,"line":1,"column":1},"items":["identifier","number"],"context":["expression"]}'
//       )
//       expect(legacy.expected).toEqual(["identifier", "number"])
//       expect(legacy.found).toBeUndefined()
//     })

//     test("converts Unexpected error", () => {
//       const error: ParseErr = {
//         tag: "Unexpected",
//         span: { offset: 5, length: 1, line: 1, column: 6 },
//         found: ";",
//         context: []
//       }
//       const bundle = new ParseErrorBundle([error], source)
//       const legacy = legacyError(bundle)

//       expect(legacy).toBeInstanceOf(ParserError)
//       expect(legacy.message).toBe(
//         'Unexpected: {"tag":"Unexpected","span":{"offset":5,"length":1,"line":1,"column":6},"found":";","context":[]}'
//       )
//       expect(legacy.expected).toEqual([])
//       expect(legacy.found).toBe(";")
//     })

//     test("converts Custom error", () => {
//       const error: ParseErr = {
//         tag: "Custom",
//         span: { offset: 10, length: 3, line: 2, column: 1 },
//         message: "Invalid syntax error",
//         hints: ["lambda"],
//         context: ["expression"]
//       }
//       const bundle = new ParseErrorBundle([error], source)
//       const legacy = legacyError(bundle)

//       expect(legacy).toBeInstanceOf(ParserError)
//       expect(legacy.message).toBe("Invalid syntax error")
//       expect(legacy.expected).toEqual([])
//       expect(legacy.found).toBeUndefined()
//     })
//   })
// })
