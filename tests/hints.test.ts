import { describe, expect, test } from "bun:test"
import { Either } from "../src/either"
import {
	anyKeywordWithHints,
	generateHints,
	keywordWithHints,
	levenshteinDistance,
	stringWithHints,
} from "../src/hints"
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

describe("hint generation", () => {
	describe("levenshteinDistance", () => {
		test("identical strings have distance 0", () => {
			expect(levenshteinDistance("hello", "hello")).toBe(0)
			expect(levenshteinDistance("", "")).toBe(0)
			expect(levenshteinDistance("a", "a")).toBe(0)
		})

		test("empty string distances", () => {
			expect(levenshteinDistance("", "hello")).toBe(5)
			expect(levenshteinDistance("hello", "")).toBe(5)
		})

		test("single character operations", () => {
			// Single insertion
			expect(levenshteinDistance("cat", "cats")).toBe(1)
			// Single deletion
			expect(levenshteinDistance("cats", "cat")).toBe(1)
			// Single substitution
			expect(levenshteinDistance("cat", "bat")).toBe(1)
		})

		test("complex transformations", () => {
			expect(levenshteinDistance("kitten", "sitting")).toBe(3)
			expect(levenshteinDistance("saturday", "sunday")).toBe(3)
			expect(levenshteinDistance("lambda", "lamdba")).toBe(2) // transpose
		})

		test("case sensitivity", () => {
			expect(levenshteinDistance("Hello", "hello")).toBe(1)
			expect(levenshteinDistance("TEST", "test")).toBe(4)
		})
	})

	describe("generateHints", () => {
		const keywords = ["lambda", "let", "if", "cond", "define", "quote"]

		test("exact matches are excluded", () => {
			const hints = generateHints("lambda", keywords)
			expect(hints).toEqual([])
		})

		test("close matches within distance", () => {
			const hints = generateHints("lamdba", keywords)
			expect(hints).toContain("lambda")
		})

		test("sorts by edit distance", () => {
			const hints = generateHints("lam", keywords, 3) // Increase max distance
			// "lam" -> "let" = distance 2 (substitute a->e, add t)
			// "lam" -> "lambda" = distance 3 (add b, d, a)
			// So "let" should come before "lambda"
			expect(hints.length).toBeGreaterThan(0)
			expect(hints[0]).toBe("let") // closest match first
			expect(hints).toContain("lambda")
		})

		test("respects maxDistance parameter", () => {
			const hints = generateHints("xyz", keywords, 1)
			expect(hints).toEqual([]) // no keywords within distance 1
			
			const hintsWithHigherDistance = generateHints("xyz", keywords, 3)
			expect(hintsWithHigherDistance.length).toBeGreaterThan(0)
		})

		test("respects maxHints parameter", () => {
			const hints = generateHints("x", keywords, 5, 2)
			expect(hints.length).toBeLessThanOrEqual(2)
		})

		test("common programming typos", () => {
			const jsKeywords = ["function", "const", "let", "var", "class", "return"]
			
			expect(generateHints("functoin", jsKeywords)).toContain("function")
			expect(generateHints("calss", jsKeywords)).toContain("class")
			expect(generateHints("retrun", jsKeywords)).toContain("return")
		})

		test("empty expected array", () => {
			const hints = generateHints("test", [])
			expect(hints).toEqual([])
		})
	})

	describe("keywordWithHints", () => {
		const schemeKeywords = ["lambda", "let", "if", "cond", "define", "quote"]
		const lambdaParser = keywordWithHints(schemeKeywords)("lambda")

		test("matches exact keyword", () => {
			const result = lambdaParser.parse("lambda")
			expect(Either.isRight(result.result)).toBe(true)
			if (Either.isRight(result.result)) {
				expect(result.result.right).toBe("lambda")
			}
		})

		test("provides hints for typos", () => {
			const result = lambdaParser.parse("lamdba")
			expect(Either.isLeft(result.result)).toBe(true)
			if (Either.isLeft(result.result)) {
				const error = result.result.left
				const primary = error.primary
				if (primary.tag === "Unexpected") {
					expect(primary.found).toBe("lamdba")
					expect(primary.hints).toContain("lambda")
				} else if (primary.tag === "Custom") {
					expect(primary.message).toContain("Unexpected")
					expect(primary.message).toContain("lamdba")
				}
			}
		})

		test("handles non-alphabetic characters", () => {
			const result = lambdaParser.parse("123")
			expect(Either.isLeft(result.result)).toBe(true)
			if (Either.isLeft(result.result)) {
				const error = result.result.left
				expect(getErrorMessage(error)).toContain("Unexpected")
			}
		})

		test("handles end of input", () => {
			const result = lambdaParser.parse("")
			expect(Either.isLeft(result.result)).toBe(true)
		})

		test("keyword boundary handling", () => {
			const result = lambdaParser.parse("lambdaXYZ")
			expect(Either.isRight(result.result)).toBe(true)
			if (Either.isRight(result.result)) {
				expect(result.result.right).toBe("lambda")
				expect(result.state.remaining).toBe("XYZ")
			}
		})
	})

	describe("anyKeywordWithHints", () => {
		const keywords = ["red", "green", "blue", "yellow"]
		const colorParser = anyKeywordWithHints(keywords)

		test("matches any valid keyword", () => {
			for (const keyword of keywords) {
				const result = colorParser.parse(keyword)
				expect(Either.isRight(result.result)).toBe(true)
				if (Either.isRight(result.result)) {
					expect(result.result.right).toBe(keyword)
				}
			}
		})

		test("provides hints for invalid input", () => {
			const result = colorParser.parse("gren")
			expect(Either.isLeft(result.result)).toBe(true)
			if (Either.isLeft(result.result)) {
				const error = result.result.left
				expect(getErrorMessage(error)).toContain("gren")
			}
		})

		test("chooses first matching keyword", () => {
			const overlappingKeywords = ["test", "testing", "tester"]
			const parser = anyKeywordWithHints(overlappingKeywords)
			const result = parser.parse("testing")
			
			expect(Either.isRight(result.result)).toBe(true)
			if (Either.isRight(result.result)) {
				expect(result.result.right).toBe("test")
			}
		})
	})

	describe("stringWithHints", () => {
		const validColors = ["red", "green", "blue", "yellow"]
		const colorStringParser = stringWithHints(validColors)

		test("matches valid quoted strings", () => {
			const result = colorStringParser.parse('"red"')
			expect(Either.isRight(result.result)).toBe(true)
			if (Either.isRight(result.result)) {
				expect(result.result.right).toBe("red")
			}
		})

		test("provides hints for invalid content", () => {
			const result = colorStringParser.parse('"gren"')
			expect(Either.isLeft(result.result)).toBe(true)
			if (Either.isLeft(result.result)) {
				const error = result.result.left
				expect(getErrorMessage(error)).toContain("gren")
			}
		})

		test("requires opening quote", () => {
			const result = colorStringParser.parse("red")
			expect(Either.isLeft(result.result)).toBe(true)
			if (Either.isLeft(result.result)) {
				const error = result.result.left
				expect(getErrorMessage(error)).toContain("Expected")
				expect(getErrorMessage(error)).toContain("string literal")
			}
		})

		test("requires closing quote", () => {
			const result = colorStringParser.parse('"red')
			expect(Either.isLeft(result.result)).toBe(true)
			if (Either.isLeft(result.result)) {
				const error = result.result.left
				expect(getErrorMessage(error)).toContain("closing quote")
			}
		})

		test("handles empty strings", () => {
			const parserWithEmpty = stringWithHints(["", "test"])
			const result = parserWithEmpty.parse('""')
			expect(Either.isRight(result.result)).toBe(true)
			if (Either.isRight(result.result)) {
				expect(result.result.right).toBe("")
			}
		})
	})

	describe("integration with labels", () => {
		test("hints work with labeled parsers", () => {
			const keywords = ["lambda", "let", "if"]
			const parser = keywordWithHints(keywords)("lambda").label("lambda keyword")
			
			const result = parser.parse("lamdba")
			expect(Either.isLeft(result.result)).toBe(true)
			if (Either.isLeft(result.result)) {
				const error = result.result.left
				expect(getErrorMessage(error)).toContain("Expected")
			}
		})

		test("context is preserved in hints", () => {
			const keywords = ["function", "method", "procedure"]
			const parser = anyKeywordWithHints(keywords)
				.label("declaration keyword")
				.label("function declaration")
			
			// This should preserve the context stack
			const result = parser.parse("functin")
			expect(Either.isLeft(result.result)).toBe(true)
		})
	})

	describe("real-world scenarios", () => {
		test("JavaScript keyword suggestions", () => {
			const jsKeywords = [
				"function", "const", "let", "var", "class", "if", "else", 
				"for", "while", "return", "import", "export", "default"
			]
			
			const testCases = [
				{ input: "functoin", expected: "function" },
				{ input: "retrun", expected: "return" },
				{ input: "calss", expected: "class" },
				{ input: "ipmort", expected: "import" },
			]

			for (const { input, expected } of testCases) {
				const hints = generateHints(input, jsKeywords)
				expect(hints).toContain(expected)
			}
		})

		test("SQL keyword suggestions", () => {
			const sqlKeywords = ["SELECT", "FROM", "WHERE", "ORDER", "GROUP", "INSERT", "UPDATE", "DELETE"]
			
			const hints = generateHints("SLECT", sqlKeywords)
			expect(hints).toContain("SELECT")
		})

		test("HTML tag suggestions", () => {
			const htmlTags = ["div", "span", "p", "h1", "h2", "button", "input", "form"]
			
			const hints = generateHints("botton", htmlTags)
			expect(hints).toContain("button")
		})
	})
})
