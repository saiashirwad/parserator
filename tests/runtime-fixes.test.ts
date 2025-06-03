import { describe, expect, it } from "bun:test";
import { Parser } from "../src/parser";
import { regex, many0, many1, notFollowedBy, optional, sepBy, sequence } from "../src/combinators";
import { State } from "../src/state";
import { Either } from "../src/either";

describe("runtime fixes", () => {
  describe("regex state advancement (issue #1)", () => {
    it("should advance state after successful match", () => {
      const parser = regex(/abc/);
      const state = State.fromInput("abcdef", { source: "abcdef" });

      const result = parser.run(state);

      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toBe("abc");
      }
      expect(result.state.pos.offset).toBe(3);
      expect(result.state.remaining).toBe("def");
    });

    it("should prevent infinite loops in many0 with regex", () => {
      const parser = many0(regex(/a/)); // Match single 'a' characters
      const state = State.fromInput("aaa", { source: "aaa" });

      const result = parser.run(state);

      // Should match each 'a' individually
      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toEqual(["a", "a", "a"]);
      }
      expect(result.state.remaining).toBe("");
    });

    it("should work correctly with many1 and regex", () => {
      const parser = many1(regex(/\d/));
      const state = State.fromInput("123abc", { source: "123abc" });

      const result = parser.run(state);

      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toEqual(["1", "2", "3"]);
      }
      expect(result.state.remaining).toBe("abc");
    });
  });

  describe("notFollowedBy state preservation (issue #2)", () => {
    it("should not advance state on success (when inner parser fails)", () => {
      const parser = notFollowedBy(regex(/xyz/));
      const state = State.fromInput("abc", { source: "abc" });

      const result = parser.run(state);

      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toBe(true);
      }
      expect(result.state.pos.offset).toBe(0); // Should not advance
      expect(result.state.remaining).toBe("abc");
    });

    it("should not advance state even if inner parser would consume input", () => {
      const innerParser = regex(/ab/);
      const parser = notFollowedBy(innerParser);
      const state = State.fromInput("xyz", { source: "xyz" });

      const result = parser.run(state);

      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toBe(true);
      }
      expect(result.state.pos.offset).toBe(0); // Should not advance
      expect(result.state.remaining).toBe("xyz");
    });

    it("should fail when inner parser matches", () => {
      const parser = notFollowedBy(regex(/abc/));
      const state = State.fromInput("abc", { source: "abc" });

      const result = parser.run(state);

      expect(Either.isLeft(result.result)).toBe(true);
    });
  });

  describe("optional state preservation (issue #3)", () => {
    it("should not advance state when inner parser fails", () => {
      const parser = optional(regex(/xyz/));
      const state = State.fromInput("abc", { source: "abc" });

      const result = parser.run(state);

      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toBeUndefined();
      }
      expect(result.state.pos.offset).toBe(0); // Should not advance
      expect(result.state.remaining).toBe("abc");
    });

    it("should advance state when inner parser succeeds", () => {
      const parser = optional(regex(/abc/));
      const state = State.fromInput("abc", { source: "abc" });

      const result = parser.run(state);

      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toBe("abc");
      }
      expect(result.state.pos.offset).toBe(3); // Should advance
      expect(result.state.remaining).toBe("");
    });
  });

  describe("infinite loop prevention (issue #4)", () => {
    it("should prevent infinite loop in many0 with non-advancing parser", () => {
      // Create a parser that succeeds but doesn't advance
      const nonAdvancingParser = new Parser(state => {
        return Parser.succeed("x", state); // Returns same state
      });

      const parser = many0(nonAdvancingParser);
      const state = State.fromInput("test", { source: "test" });

      expect(() => parser.run(state)).toThrow("Parser did not advance - infinite loop prevented");
    });

    it("should prevent infinite loop in many1 with non-advancing parser", () => {
      const nonAdvancingParser = new Parser(state => {
        return Parser.succeed("x", state);
      });

      const parser = many1(nonAdvancingParser);
      const state = State.fromInput("test", { source: "test" });

      expect(() => parser.run(state)).toThrow("Parser did not advance - infinite loop prevented");
    });

    it("should prevent infinite loop with non-advancing separator", () => {
      const advancingParser = regex(/\d/);
      const nonAdvancingSeparator = new Parser(state => {
        return Parser.succeed(",", state); // Separator doesn't advance
      });

      const parser = many1(advancingParser, nonAdvancingSeparator);
      const state = State.fromInput("1,2,3", { source: "1,2,3" });

      expect(() => parser.run(state)).toThrow(
        "Separator parser did not advance - infinite loop prevented"
      );
    });

    it("should work correctly with properly advancing parsers", () => {
      const parser = many0(regex(/\d/));
      const state = State.fromInput("123abc", { source: "123abc" });

      const result = parser.run(state);

      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toEqual(["1", "2", "3"]);
      }
      expect(result.state.remaining).toBe("abc");
    });
  });

  describe("sepBy empty list handling (issue #5)", () => {
    it("should return empty array when first element fails", () => {
      const parser = sepBy(regex(/,/), regex(/\d/));
      const state = State.fromInput("abc", { source: "abc" });

      const result = parser.run(state);

      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toEqual([]);
      }
      expect(result.state.pos.offset).toBe(0); // Should not advance
      expect(result.state.remaining).toBe("abc");
    });

    it("should parse single element without separator", () => {
      const parser = sepBy(regex(/,/), regex(/\d/));
      const state = State.fromInput("1abc", { source: "1abc" });

      const result = parser.run(state);

      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toEqual(["1"]);
      }
      expect(result.state.remaining).toBe("abc");
    });

    it("should parse multiple elements with separators", () => {
      const parser = sepBy(regex(/,/), regex(/\d/));
      const state = State.fromInput("1,2,3abc", { source: "1,2,3abc" });

      const result = parser.run(state);

      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toEqual(["1", "2", "3"]);
      }
      expect(result.state.remaining).toBe("abc");
    });

    it("should stop at first separator failure", () => {
      const parser = sepBy(regex(/,/), regex(/\d/));
      const state = State.fromInput("1;2,3", { source: "1;2,3" });

      const result = parser.run(state);

      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toEqual(["1"]); // Stops at ';'
      }
      expect(result.state.remaining).toBe(";2,3");
    });
  });

  describe("sequence implementation cleanup (issue #6)", () => {
    it("should return last parser result", () => {
      const parser1 = regex(/a/);
      const parser2 = regex(/b/);
      const parser3 = regex(/c/);

      const parser = sequence([parser1, parser2, parser3]);
      const state = State.fromInput("abc", { source: "abc" });

      const result = parser.run(state);

      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toBe("c"); // Should be last result
      }
      expect(result.state.remaining).toBe("");
    });

    it("should fail on first parser failure", () => {
      const parser1 = regex(/x/); // Will fail
      const parser2 = regex(/b/);

      const parser = sequence([parser1, parser2]);
      const state = State.fromInput("abc", { source: "abc" });

      const result = parser.run(state);

      expect(Either.isLeft(result.result)).toBe(true);
    });

    it("should fail on middle parser failure", () => {
      const parser1 = regex(/a/);
      const parser2 = regex(/x/); // Will fail
      const parser3 = regex(/c/);

      const parser = sequence([parser1, parser2, parser3]);
      const state = State.fromInput("abc", { source: "abc" });

      const result = parser.run(state);

      expect(Either.isLeft(result.result)).toBe(true);
    });

    it("should properly advance state through all parsers", () => {
      const parser1 = regex(/ab/);
      const parser2 = regex(/cd/);

      const parser = sequence([parser1, parser2]);
      const state = State.fromInput("abcdef", { source: "abcdef" });

      const result = parser.run(state);

      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toBe("cd");
      }
      expect(result.state.pos.offset).toBe(4);
      expect(result.state.remaining).toBe("ef");
    });
  });

  describe("comprehensive integration tests", () => {
    it("should handle complex nested parsing without infinite loops", () => {
      // Test that combines multiple fixed combinators
      const digit = regex(/\d/);
      const comma = regex(/,/);
      const numberList = sepBy(comma, digit);
      const optionalList = optional(numberList);

      const parser = optionalList; // Just use the optional list directly
      const state = State.fromInput("1,2,3", { source: "1,2,3" });

      const result = parser.run(state);

      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toEqual(["1", "2", "3"]);
      }
      expect(result.state.remaining).toBe("");
    });

    it("should handle empty input gracefully", () => {
      const parser = sepBy(regex(/,/), regex(/\d/));
      const state = State.fromInput("", { source: "" });

      const result = parser.run(state);

      expect(Either.isRight(result.result)).toBe(true);
      if (Either.isRight(result.result)) {
        expect(result.result.right).toEqual([]);
      }
      expect(result.state.remaining).toBe("");
    });

    it("should handle negative lookahead in complex scenarios", () => {
      const notNumber = notFollowedBy(regex(/\d/));
      const letter = regex(/[a-z]/);
      const letterNotNumber = sequence([notNumber, letter]);

      const state1 = State.fromInput("a", { source: "a" });
      const result1 = letterNotNumber.run(state1);
      expect(Either.isRight(result1.result)).toBe(true);
      if (Either.isRight(result1.result)) {
        expect(result1.result.right).toBe("a");
      }

      const state2 = State.fromInput("1", { source: "1" });
      const result2 = letterNotNumber.run(state2);
      expect(Either.isLeft(result2.result)).toBe(true);
    });
  });
});
