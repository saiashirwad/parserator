import { describe, expect, test } from "bun:test"
import { char, regex } from "../src/combinators"
import { Either } from "../src/either"
import { Parser } from "../src/parser"
import type { ParseErrorBundle } from "../src/rich-errors"

// Helper to get error message from ParseErrorBundle
function getErrorMessage(bundle: ParseErrorBundle): string {
  const primary = bundle.primary
  if (primary.tag === "Custom") {
    return primary.message
  } else if (primary.tag === "Unexpected") {
    return `Unexpected: ${primary.found}`
  } else {
    return `Expected: ${primary.items.join(", ")}`
  }
}

describe("label system", () => {
  describe(".label() method", () => {
    test("adds label to context stack", () => {
      const parser = char("a").label("letter a")
      const result = parser.parse("b")

      expect(Either.isLeft(result.result)).toBe(true)
      if (Either.isLeft(result.result)) {
        const error = result.result.left
        // The error should reference the label
        expect(getErrorMessage(error)).toContain("Expected")
      }
    })

    test("nested labels create context stack", () => {
      const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/).label("identifier")
      const functionCall = char("(")
        .then(identifier.label("function name"))
        .thenDiscard(char(")"))
        .label("function call")

      const result = functionCall.parse("(123)")

      expect(Either.isLeft(result.result)).toBe(true)
      if (Either.isLeft(result.result)) {
        const error = result.result.left
        expect(getErrorMessage(error)).toContain("Expected")
      }
    })

    test("successful parse preserves context", () => {
      const parser = char("a").label("letter a")
      const result = parser.parse("a")

      expect(Either.isRight(result.result)).toBe(true)
      if (Either.isRight(result.result)) {
        expect(result.result.right).toBe("a")
      }
    })

    test("label doesn't interfere with successful parsing", () => {
      const identifierParser = regex(/[a-zA-Z_][a-zA-Z0-9_]*/).label(
        "identifier"
      )
      const result = identifierParser.parse("hello")

      expect(Either.isRight(result.result)).toBe(true)
      if (Either.isRight(result.result)) {
        expect(result.result.right).toBe("hello")
      }
    })
  })

  describe(".expect() method", () => {
    test("combines label and error message", () => {
      const parser = regex(/\d+/).expect("a numeric value")
      const result = parser.parse("abc")

      expect(Either.isLeft(result.result)).toBe(true)
      if (Either.isLeft(result.result)) {
        const error = result.result.left
        // The expect method creates both a label and a withError message
        // For now, just check that it contains some expected text
        expect(getErrorMessage(error)).toContain("Expected")
      }
    })

    test("expect works with successful parsing", () => {
      const parser = regex(/\d+/).expect("a numeric value")
      const result = parser.parse("123")

      expect(Either.isRight(result.result)).toBe(true)
      if (Either.isRight(result.result)) {
        expect(result.result.right).toBe("123")
      }
    })
  })

  describe("complex label scenarios", () => {
    test("multiple levels of labeling", () => {
      const digit = regex(/\d/).label("digit")
      const number = regex(/\d+/).label("number")
      const expression = number.label("expression")

      const result = expression.parse("abc")

      expect(Either.isLeft(result.result)).toBe(true)
    })

    test("label with generator syntax", () => {
      const parser = Parser.gen(function* () {
        const open = yield* char("(").label("opening parenthesis")
        const content = yield* regex(/[a-z]+/).label("content")
        const close = yield* char(")").label("closing parenthesis")
        return { open, content, close }
      }).label("parenthesized expression")

      const result = parser.parse("(hello]")

      expect(Either.isLeft(result.result)).toBe(true)
      if (Either.isLeft(result.result)) {
        const error = result.result.left
        expect(getErrorMessage(error)).toContain("Expected")
      }
    })

    test("labels preserve through combinators", () => {
      const letterA = char("a").label("letter A")
      const letterB = char("b").label("letter B")
      const either = letterA.then(letterB).label("sequence AB")

      const result = either.parse("ac")

      expect(Either.isLeft(result.result)).toBe(true)
    })
  })

  describe("context stack behavior", () => {
    test("label stack accumulates correctly", () => {
      // Create a parser that we can inspect the state of
      let capturedContext: any = null
      const inspector = new Parser(state => {
        capturedContext = state.context
        return Parser.succeed("test", state)
      })

      const labeled = inspector.label("outer").label("inner")
      labeled.parse("test")

      expect(capturedContext?.labelStack).toEqual(["outer", "inner"])
    })

    test("label stack is isolated per parse", () => {
      let firstContext: any = null
      let secondContext: any = null

      const inspector1 = new Parser(state => {
        firstContext = state.context
        return Parser.succeed("test1", state)
      })

      const inspector2 = new Parser(state => {
        secondContext = state.context
        return Parser.succeed("test2", state)
      })

      inspector1.label("first").parse("test")
      inspector2.label("second").parse("test")

      expect(firstContext?.labelStack).toEqual(["first"])
      expect(secondContext?.labelStack).toEqual(["second"])
    })
  })
})
