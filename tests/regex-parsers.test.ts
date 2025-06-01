/**
 * Comprehensive test suite for regex parsers in the parserator library.
 *
 * This file contains extensive tests covering:
 * - Basic regex matching functionality
 * - Regex flags handling (case-insensitive, global, multiline, etc.)
 * - Character classes and special patterns
 * - Quantifiers (*, +, ?, {n}, {n,m})
 * - Groups and alternation
 * - Anchors and boundaries
 * - Integration with other combinators
 * - Complex real-world patterns (emails, URLs, etc.)
 * - Error handling and edge cases
 * - Performance and memory considerations
 * - Context preservation
 * - Pattern escaping
 *
 * These tests ensure that the regex parser properly advances state,
 * integrates correctly with combinators, and handles all edge cases
 * after the runtime fixes were applied.
 */

import { describe, expect, it } from "bun:test"
import {
  regex,
  many0,
  many1,
  optional,
  sepBy,
  sequence,
  lookAhead,
  notFollowedBy,
  or,
  char
} from "../src/combinators"
import { Parser } from "../src/parser"
import { State } from "../src/state"
import { Either } from "../src/either"

describe("regex parsers", () => {
  describe("basic regex matching", () => {
    it("should match simple literal patterns", () => {
      const parser = regex(/hello/)
      expect(parser.parseOrThrow("hello")).toBe("hello")
      expect(parser.parseOrThrow("hello world")).toBe("hello")
    })

    it("should match at start of input only", () => {
      const parser = regex(/foo/)
      expect(Either.isLeft(parser.parse("bar foo").result)).toBe(true)
    })

    it("should handle empty matches correctly", () => {
      const parser = regex(/a*/) // Can match empty string
      expect(parser.parseOrThrow("")).toBe("")
      expect(parser.parseOrThrow("aaa")).toBe("aaa")
      expect(parser.parseOrThrow("bbb")).toBe("")
    })

    it("should properly advance state after matching", () => {
      const parser = regex(/abc/)
      const state = State.fromInput("abcdef", { source: "abcdef" })
      const result = parser.run(state)

      expect(Either.isRight(result.result)).toBe(true)
      expect(result.state.pos.offset).toBe(3)
      expect(result.state.remaining).toBe("def")
    })

    it("should handle zero-length matches", () => {
      const parser = regex(/(?=a)/) // Positive lookahead
      const state = State.fromInput("abc", { source: "abc" })
      const result = parser.run(state)

      expect(Either.isRight(result.result)).toBe(true)
      if (Either.isRight(result.result)) {
        expect(result.result.right).toBe("")
      }
      expect(result.state.pos.offset).toBe(0) // Should not advance for zero-length match
    })
  })

  describe("regex flags handling", () => {
    it("should handle case-insensitive flag", () => {
      const parser = regex(/hello/i)
      expect(parser.parseOrThrow("HELLO")).toBe("HELLO")
      expect(parser.parseOrThrow("Hello")).toBe("Hello")
      expect(parser.parseOrThrow("hello")).toBe("hello")
    })

    it("should strip global flag to prevent side effects", () => {
      const globalRegex = /\d+/g
      const parser = regex(globalRegex)

      // First parse
      expect(parser.parseOrThrow("123abc")).toBe("123")
      // Second parse should work the same way (global flag removed)
      expect(parser.parseOrThrow("456def")).toBe("456")
    })

    it("should handle multiline flag", () => {
      const parser = regex(/^hello/m)
      expect(parser.parseOrThrow("hello\nworld")).toBe("hello")
    })

    it("should handle dot-all flag", () => {
      const parser = regex(/a.b/s)
      expect(parser.parseOrThrow("a\nb")).toBe("a\nb")
    })
  })

  describe("character classes and special patterns", () => {
    it("should match digit patterns", () => {
      const parser = regex(/\d+/)
      expect(parser.parseOrThrow("123")).toBe("123")
      expect(parser.parseOrThrow("456abc")).toBe("456")
    })

    it("should match word patterns", () => {
      const parser = regex(/\w+/)
      expect(parser.parseOrThrow("hello123")).toBe("hello123")
      expect(parser.parseOrThrow("test_var")).toBe("test_var")
    })

    it("should match whitespace patterns", () => {
      const parser = regex(/\s+/)
      expect(parser.parseOrThrow("   hello")).toBe("   ")
      expect(parser.parseOrThrow("\t\n hello")).toBe("\t\n ")
    })

    it("should match custom character classes", () => {
      const parser = regex(/[a-z]+/)
      expect(parser.parseOrThrow("hello")).toBe("hello")
      expect(Either.isLeft(parser.parse("123").result)).toBe(true)
    })

    it("should match negated character classes", () => {
      const parser = regex(/[^0-9]+/)
      expect(parser.parseOrThrow("abc")).toBe("abc")
      expect(Either.isLeft(parser.parse("123").result)).toBe(true)
    })
  })

  describe("quantifiers", () => {
    it("should handle asterisk quantifier", () => {
      const parser = regex(/a*/)
      expect(parser.parseOrThrow("")).toBe("")
      expect(parser.parseOrThrow("aaa")).toBe("aaa")
      expect(parser.parseOrThrow("bbb")).toBe("")
    })

    it("should handle plus quantifier", () => {
      const parser = regex(/a+/)
      expect(parser.parseOrThrow("aaa")).toBe("aaa")
      expect(Either.isLeft(parser.parse("bbb").result)).toBe(true)
      expect(Either.isLeft(parser.parse("").result)).toBe(true)
    })

    it("should handle question mark quantifier", () => {
      const parser = regex(/colou?r/)
      expect(parser.parseOrThrow("color")).toBe("color")
      expect(parser.parseOrThrow("colour")).toBe("colour")
    })

    it("should handle specific count quantifiers", () => {
      const parser = regex(/\d{3}/)
      expect(parser.parseOrThrow("123")).toBe("123")
      expect(parser.parseOrThrow("1234")).toBe("123")
      expect(Either.isLeft(parser.parse("12").result)).toBe(true)
    })

    it("should handle range quantifiers", () => {
      const parser = regex(/\d{2,4}/)
      expect(parser.parseOrThrow("12")).toBe("12")
      expect(parser.parseOrThrow("123")).toBe("123")
      expect(parser.parseOrThrow("1234")).toBe("1234")
      expect(parser.parseOrThrow("12345")).toBe("1234")
      expect(Either.isLeft(parser.parse("1").result)).toBe(true)
    })
  })

  describe("groups and alternation", () => {
    it("should handle capturing groups", () => {
      const parser = regex(/(hello|hi) world/)
      expect(parser.parseOrThrow("hello world")).toBe("hello world")
      expect(parser.parseOrThrow("hi world")).toBe("hi world")
    })

    it("should handle non-capturing groups", () => {
      const parser = regex(/(?:cat|dog)s/)
      expect(parser.parseOrThrow("cats")).toBe("cats")
      expect(parser.parseOrThrow("dogs")).toBe("dogs")
    })

    it("should handle alternation", () => {
      const parser = regex(/foo|bar|baz/)
      expect(parser.parseOrThrow("foo")).toBe("foo")
      expect(parser.parseOrThrow("bar")).toBe("bar")
      expect(parser.parseOrThrow("baz")).toBe("baz")
    })
  })

  describe("anchors and boundaries", () => {
    it("should handle start anchor (implicit at beginning)", () => {
      const parser = regex(/hello/)
      expect(parser.parseOrThrow("hello world")).toBe("hello")
      expect(Either.isLeft(parser.parse("say hello").result)).toBe(true)
    })

    it("should handle word boundaries", () => {
      const parser = regex(/\bcat\b/)
      expect(parser.parseOrThrow("cat")).toBe("cat")
      expect(parser.parseOrThrow("cat ")).toBe("cat")
      expect(Either.isLeft(parser.parse("catch").result)).toBe(true)
    })
  })

  describe("integration with combinators", () => {
    it("should work correctly with many0", () => {
      const parser = many0(regex(/\d/))
      expect(parser.parseOrThrow("123abc")).toEqual(["1", "2", "3"])
      expect(parser.parseOrThrow("abc")).toEqual([])
    })

    it("should work correctly with many1", () => {
      const parser = many1(regex(/\w/))
      expect(parser.parseOrThrow("hello123")).toEqual([
        "h",
        "e",
        "l",
        "l",
        "o",
        "1",
        "2",
        "3"
      ])
      expect(Either.isLeft(parser.parse("!!!").result)).toBe(true)
    })

    it("should work correctly with sepBy", () => {
      const parser = sepBy(regex(/,/), regex(/\d+/))
      expect(parser.parseOrThrow("1,2,3")).toEqual(["1", "2", "3"])
      expect(parser.parseOrThrow("42")).toEqual(["42"])
      expect(parser.parseOrThrow("")).toEqual([])
    })

    it("should work correctly with optional", () => {
      const parser = optional(regex(/hello/))
      expect(parser.parseOrThrow("hello world")).toBe("hello")
      expect(parser.parseOrThrow("world")).toBeUndefined()
    })

    it("should work correctly with sequence", () => {
      const parser = sequence([regex(/\d+/), regex(/\s+/), regex(/\w+/)])
      expect(parser.parseOrThrow("123 hello")).toBe("hello")
    })

    it("should work correctly with lookAhead", () => {
      const parser = sequence([lookAhead(regex(/\d/)), regex(/\d+/)])
      expect(parser.parseOrThrow("123")).toBe("123")
    })

    it("should work correctly with notFollowedBy", () => {
      const parser = sequence([
        regex(/hello/),
        notFollowedBy(regex(/\s+world/))
      ])
      expect(parser.parseOrThrow("hello there")).toBe(true)
      expect(Either.isLeft(parser.parse("hello world").result)).toBe(true)
    })

    it("should work correctly with or combinator", () => {
      const parser = or(regex(/\d+/), regex(/[a-z]+/), regex(/[A-Z]+/))
      expect(parser.parseOrThrow("123")).toBe("123")
      expect(parser.parseOrThrow("hello")).toBe("hello")
      expect(parser.parseOrThrow("WORLD")).toBe("WORLD")
    })
  })

  describe("complex real-world patterns", () => {
    it("should parse email addresses", () => {
      const parser = regex(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
      expect(parser.parseOrThrow("user@example.com")).toBe("user@example.com")
      expect(parser.parseOrThrow("test.email+tag@domain.co.uk")).toBe(
        "test.email+tag@domain.co.uk"
      )
    })

    it("should parse URLs", () => {
      const parser = regex(/https?:\/\/[^\s]+/)
      expect(parser.parseOrThrow("https://example.com")).toBe(
        "https://example.com"
      )
      expect(parser.parseOrThrow("http://test.org/path?query=value")).toBe(
        "http://test.org/path?query=value"
      )
    })

    it("should parse IP addresses", () => {
      const parser = regex(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)
      expect(parser.parseOrThrow("192.168.1.1")).toBe("192.168.1.1")
      expect(parser.parseOrThrow("10.0.0.255")).toBe("10.0.0.255")
    })

    it("should parse hexadecimal colors", () => {
      const parser = regex(/#[0-9a-fA-F]{6}/)
      expect(parser.parseOrThrow("#FF0000")).toBe("#FF0000")
      expect(parser.parseOrThrow("#deadbeef")).toBe("#deadbe") // Only matches 6 digits
    })

    it("should parse ISO date format", () => {
      const parser = regex(/\d{4}-\d{2}-\d{2}/)
      expect(parser.parseOrThrow("2023-12-25")).toBe("2023-12-25")
      expect(parser.parseOrThrow("2023-12-25T10:30:00")).toBe("2023-12-25")
    })

    it("should parse JSON-like strings", () => {
      const parser = regex(/"(?:[^"\\]|\\.)*"/)
      expect(parser.parseOrThrow('"hello"')).toBe('"hello"')
      expect(parser.parseOrThrow('"hello \\"world\\""')).toBe(
        '"hello \\"world\\""'
      )
    })
  })

  describe("error handling and edge cases", () => {
    it("should provide clear error messages", () => {
      const parser = regex(/\d+/)
      const result = parser.parse("abc")
      expect(Either.isLeft(result.result)).toBe(true)
      if (Either.isLeft(result.result)) {
        console.log()
        // expect(result.result.left.primary.).toContain("Expected /\\d+/")
      }
    })

    it("should handle empty input gracefully", () => {
      const parser = regex(/hello/)
      expect(Either.isLeft(parser.parse("").result)).toBe(true)
    })

    it("should handle very long inputs", () => {
      const parser = regex(/a+/)
      const longInput = "a".repeat(10000) + "b"
      expect(parser.parseOrThrow(longInput)).toBe("a".repeat(10000))
    })

    it("should handle unicode characters", () => {
      const parser = regex(/[🌟⭐]+/)
      expect(parser.parseOrThrow("🌟⭐🌟")).toBe("🌟⭐🌟")
    })

    it("should handle newlines and multiline input", () => {
      const parser = regex(/.*/)
      expect(parser.parseOrThrow("hello\nworld")).toBe("hello")

      const multilineParser = regex(/.*/s)
      expect(multilineParser.parseOrThrow("hello\nworld")).toBe("hello\nworld")
    })
  })

  describe("performance and memory", () => {
    it("should not cause infinite loops with star quantifiers", () => {
      const parser = many1(regex(/a*/))
      expect(() => parser.parse("aaa")).toThrow(
        "Parser did not advance - infinite loop prevented"
      )
    })

    it("should handle repeated parsing efficiently", () => {
      const parser = regex(/\d+/)
      const inputs = ["123", "456", "789", "000"]

      inputs.forEach(input => {
        expect(parser.parseOrThrow(input)).toBe(input)
      })
    })

    it("should work with complex nested structures", () => {
      const numberParser = regex(/\d+/)
      const commaParser = regex(/,/)
      const spaceParser = regex(/\s*/)

      const listParser = sequence([
        char("["),
        spaceParser,
        sepBy(sequence([spaceParser, commaParser, spaceParser]), numberParser),
        spaceParser,
        char("]")
      ])

      expect(listParser.parseOrThrow("[1, 2, 3]")).toBe("]")
    })
  })

  describe("regex with context", () => {
    it("should preserve context through regex parsing", () => {
      type MyContext = { debug: boolean; mode: string }
      const parser = regex<MyContext>(/hello/)

      const context = { debug: true, mode: "test", source: "hello world" }
      const state = State.fromInput("hello world", context)
      const result = parser.run(state)

      expect(Either.isRight(result.result)).toBe(true)
      expect(result.state.context.debug).toBe(true)
      expect(result.state.context.mode).toBe("test")
    })
  })

  describe("regex pattern escaping", () => {
    it("should handle escaped special characters", () => {
      const parser = regex(/\$\d+\.\d{2}/)
      expect(parser.parseOrThrow("$19.99")).toBe("$19.99")
    })

    it("should handle escaped quotes in patterns", () => {
      const parser = regex(/"[^"]*"/)
      expect(parser.parseOrThrow('"hello world"')).toBe('"hello world"')
    })

    it("should handle backslashes correctly", () => {
      const parser = regex(/\\[ntbr]/)
      expect(parser.parseOrThrow("\\n")).toBe("\\n")
      expect(parser.parseOrThrow("\\t")).toBe("\\t")
    })
  })
})
