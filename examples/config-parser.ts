/**
 * Configuration Parser Demo
 *
 * Demonstrates advanced error handling features:
 * - Rich error messages with context
 * - Intelligent hint generation for typos
 * - Hierarchical error labeling
 * - Beautiful error formatting
 */

import {
  Parser,
  string,
  or,
  sequence,
  many,
  optional,
  regex,
  eof,
  ErrorFormatter,
  ParseErrorBundle,
  keywordWithHints,
  anyKeywordWithHints,
  Either
} from "../src/index";

// Configuration language grammar:
// config ::= statement*
// statement ::= setting | section | comment
// setting ::= identifier "=" value
// section ::= "[" identifier "]"
// value ::= string | number | boolean | array
// array ::= "[" (value ("," value)*)? "]"

const whitespace = regex(/\s+/);
const optionalWhitespace = optional(whitespace);
const comment = regex(/#[^\n]*/);

// Identifiers with hint generation for common typos
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/)
  .label("identifier")
  .expect("valid identifier (letters, numbers, underscores)");

// String literals with proper escaping
const stringLiteral = sequence([
  string('"'),
  regex(/(?:[^"\\]|\\.)*/),
  string('"')
])
  .map(([, content]) => content)
  .label("string literal");

// Numbers (integers and floats)
const numberLiteral = regex(/-?\d+(?:\.\d+)?/)
  .map(str => parseFloat(str))
  .label("number");

// Booleans with smart hints for typos
const booleanLiteral = anyKeywordWithHints(["true", "false"])
  .map(str => str === "true")
  .label("boolean");

// Any value type (forward declaration for recursion)
let value: Parser<any>;

// Array values
const arrayValue: Parser<any[]> = sequence([
  string("["),
  optionalWhitespace,
  optional(
    sequence([
      or(stringLiteral, numberLiteral, booleanLiteral),
      many(
        sequence([
          optionalWhitespace,
          string(","),
          optionalWhitespace,
          or(stringLiteral, numberLiteral, booleanLiteral)
        ]).map(([, , , val]) => val)
      )
    ]).map(([first, rest]) => [first, ...rest])
  ),
  optionalWhitespace,
  string("]")
])
  .map(([, , values]) => values || [])
  .label("array");

// Define value after arrayValue is defined
value = or(stringLiteral, numberLiteral, booleanLiteral, arrayValue).label(
  "value"
);

// Settings: key = value
const setting = sequence([
  identifier,
  optionalWhitespace,
  string("="),
  optionalWhitespace,
  value
])
  .map(([key, , , , val]) => ({ type: "setting", key, value: val }))
  .label("setting");

// Sections: [section_name]
const section = sequence([
  string("["),
  optionalWhitespace,
  identifier,
  optionalWhitespace,
  string("]")
])
  .map(([, , name]) => ({ type: "section", name }))
  .label("section");

// Statements with error recovery
const statement = or(
  setting,
  section,
  comment.map(() => ({ type: "comment" }))
).label("statement");

// Full config parser that consumes all input
const configParser = sequence([
  optionalWhitespace,
  many(sequence([statement, optionalWhitespace]).map(([stmt]) => stmt)),
  optionalWhitespace,
  eof // Ensure we consume all input
])
  .map(([, statements]) => statements.filter(s => s.type !== "comment"))
  .label("configuration file");

// Demo function with comprehensive error handling
export function parseConfig(input: string): void {
  console.log("🔍 Parsing configuration...");
  console.log("Input:", JSON.stringify(input));
  console.log();

  const output = configParser.parse(input);

  if (Either.isRight(output.result)) {
    console.log("✅ Parse successful!");
    console.log("Result:", JSON.stringify(output.result.right, null, 2));
  } else {
    console.log("❌ Parse failed!");

    const formatter = new ErrorFormatter();

    console.log("\n📝 Plain text error:");
    console.log(formatter.format(output.result.left));
  }
  console.log("\n" + "=".repeat(80) + "\n");
}

// Test cases showcasing different error scenarios
if (import.meta.main) {
  console.log("🚀 Configuration Parser Demo\n");

  // Valid config
  parseConfig(`[database]
host = "localhost"
port = 5432
enabled = true

[features]
tags = ["api", "web", "mobile"]
timeout = 30.5`);

  // Typo in boolean value - should suggest "true"
  parseConfig(`debug = tru`);

  // Missing closing bracket
  parseConfig(`[server
port = 8080`);

  // Invalid array syntax
  parseConfig(`items = [1, 2, 3`);

  // Unexpected character
  parseConfig(`name = "test"
@ invalid`);

  // Missing value
  parseConfig(`timeout = `);
}
