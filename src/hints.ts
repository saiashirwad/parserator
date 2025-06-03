import { Parser } from "./parser";
import { type ParseErr, createSpan } from "./errors";
import { State } from "./state";

/**
 * Calculate the Levenshtein distance between two strings.
 * This measures the minimum number of single-character edits (insertions, deletions, or substitutions)
 * required to change one string into another.
 *
 * @param a - The first string
 * @param b - The second string
 * @returns The edit distance between the strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));

  // Initialize first row and column
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  // Fill the matrix
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Generate helpful hints for a user's input based on a list of expected values.
 * Uses edit distance to find the closest matches and suggests them as "Did you mean..." options.
 *
 * @param found - The string the user actually typed
 * @param expected - Array of valid/expected strings
 * @param maxDistance - Maximum edit distance to consider (default: 2)
 * @param maxHints - Maximum number of hints to return (default: 3)
 * @returns Array of suggested strings, sorted by edit distance
 */
export function generateHints(
  found: string,
  expected: string[],
  maxDistance: number = 2,
  maxHints: number = 3
): string[] {
  const hints: Array<{ word: string; distance: number }> = [];

  for (const candidate of expected) {
    const distance = levenshteinDistance(found, candidate);
    if (distance <= maxDistance && distance > 0) {
      hints.push({ word: candidate, distance });
    }
  }

  return hints
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxHints)
    .map(h => h.word);
}

/**
 * Enhanced keyword parser that provides intelligent hints when the user types something similar.
 *
 * @param keywords - Array of valid keywords to match against
 * @returns A function that creates a parser for a specific keyword with hint generation
 *
 * @example
 * ```ts
 * const schemeKeywords = ["lambda", "let", "if", "cond", "define", "quote"]
 * const lambdaParser = keywordWithHints(schemeKeywords)("lambda")
 *
 * // Parsing "lamdba" will suggest "lambda" as a hint
 * const result = lambdaParser.parse("lamdba")
 * ```
 */
export const keywordWithHints = (keywords: string[]) => (keyword: string) =>
  new Parser(state => {
    if (state.remaining.startsWith(keyword)) {
      return Parser.succeed(keyword, State.consume(state, keyword.length));
    }

    // Try to extract what the user actually typed
    const match = state.remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    const found = match ? match[0] : state.remaining[0] || "end of input";

    const hints = generateHints(found, keywords);

    const error: ParseErr = {
      tag: "Unexpected",
      span: createSpan(state, found.length),
      found,
      context: state.context.labelStack || [],
      ...(hints.length > 0 && { hints })
    };

    return Parser.failRich({ errors: [error] }, state);
  });

/**
 * Creates a parser that matches any of the provided keywords with hint generation.
 *
 * @param keywords - Array of valid keywords
 * @returns A parser that matches any keyword and provides hints for typos
 *
 * @example
 * ```ts
 * const jsKeywords = ["function", "const", "let", "var", "class", "if", "else"]
 * const keywordParser = anyKeywordWithHints(jsKeywords)
 *
 * // Parsing "functoin" will suggest "function"
 * const result = keywordParser.parse("functoin")
 * ```
 */
export function anyKeywordWithHints<Ctx = {}>(keywords: string[]): Parser<string, Ctx> {
  return new Parser(state => {
    // Try each keyword
    for (const keyword of keywords) {
      if (state.remaining.startsWith(keyword)) {
        return Parser.succeed(keyword, State.consume(state, keyword.length));
      }
    }

    // No exact match found, try to extract what was typed and generate hints
    const match = state.remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    const found = match ? match[0] : state.remaining[0] || "end of input";

    const hints = generateHints(found, keywords);

    const error: ParseErr = {
      tag: "Unexpected",
      span: createSpan(state, found.length),
      found,
      context: state.context.labelStack || [],
      ...(hints.length > 0 && { hints })
    };

    return Parser.failRich({ errors: [error] }, state);
  });
}

/**
 * Creates a parser for string literals with hint generation for common mistakes.
 *
 * @param validStrings - Array of valid string values
 * @returns A parser that matches quoted strings and provides hints for typos
 *
 * @example
 * ```ts
 * const colorParser = stringWithHints(["red", "green", "blue", "yellow"])
 *
 * // Parsing '"gren"' will suggest "green"
 * const result = colorParser.parse('"gren"')
 * ```
 */
export function stringWithHints<Ctx = {}>(validStrings: string[]): Parser<string, Ctx> {
  return new Parser(state => {
    // Must start with quote
    if (!state.remaining.startsWith('"')) {
      const error: ParseErr = {
        tag: "Expected",
        span: createSpan(state, 1),
        items: ["string literal"],
        context: state.context.labelStack || []
      };
      return Parser.failRich({ errors: [error] }, state);
    }

    // Find the closing quote
    let i = 1;
    let content = "";
    while (i < state.remaining.length && state.remaining[i] !== '"') {
      content += state.remaining[i];
      i++;
    }

    if (i >= state.remaining.length) {
      const error: ParseErr = {
        tag: "Expected",
        span: createSpan(state, i),
        items: ["closing quote"],
        context: state.context.labelStack || []
      };
      return Parser.failRich({ errors: [error] }, state);
    }

    // Check if content is valid
    if (validStrings.includes(content)) {
      return Parser.succeed(content, State.consume(state, i + 1));
    }

    // Generate hints for invalid content
    const hints = generateHints(content, validStrings);

    const error: ParseErr = {
      tag: "Unexpected",
      span: createSpan(state, i + 1),
      found: `"${content}"`,
      context: state.context.labelStack || [],
      ...(hints.length > 0 && { hints: hints.map(h => `"${h}"`) })
    };

    return Parser.failRich({ errors: [error] }, state);
  });
}
