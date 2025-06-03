import { char, ErrorFormatter, parser, optional, or, regex, string, takeUpto } from "../src";

// Data structures for INI file representation
interface IniSection {
  name: string;
  properties: Map<string, string>;
}

// Helper parsers
const whitespace = regex(/\s*/);
const horizontalSpace = regex(/[ \t]*/);
const eol = or(string("\n"), string("\r\n"), string("\r"));

// Parse section header like [database]
const sectionHeader = parser(function* () {
  yield* char("[");
  const name = yield* takeUpto(char("]"));
  yield* char("]");
  return name.trim();
});

// Parse key (left side of =)
const key = parser(function* () {
  const k = yield* takeUpto(char("="));
  return k.trim();
});

// Parse value (right side of =, until end of line)
const value = parser(function* () {
  const v = yield* takeUpto(eol);
  return v.trim();
});

// Parse key-value pair like "host=localhost"
const keyValue = parser(function* () {
  yield* horizontalSpace;
  const k = yield* key;
  yield* char("=");
  const v = yield* value;
  return { key: k, value: v };
});

// Parse a complete section with key-value pairs
const iniSection = parser(function* () {
  // Parse section header
  yield* horizontalSpace;
  const header = yield* sectionHeader;
  yield* horizontalSpace;
  yield* optional(eol);

  const pairs: Array<{ key: string; value: string }> = [];

  // Parse key-value pairs
  while (true) {
    yield* horizontalSpace;

    // Try to parse a key-value pair
    const pair = yield* optional(keyValue);
    if (!pair) {
      break;
    }

    pairs.push(pair);
    yield* optional(eol);
  }

  const properties = new Map<string, string>();
  for (const pair of pairs) {
    properties.set(pair.key, pair.value);
  }

  return { name: header, properties };
});

// Test cases demonstrating the comparison with Megaparsec
console.log("=== Test 1: Valid section header ===");
const input1 = "[database]";
const result1 = sectionHeader.parse(input1);
if (result1.result._tag === "Left") {
  const formatter = new ErrorFormatter("ansi");
  console.log(formatter.format(result1.result.left));
} else {
  console.log("Success:", result1.result.right);
}

console.log("\n=== Test 2: Section with key-value pairs ===");
const input2 = `[database]
host=localhost
port=5432
user=admin`;

const result2 = iniSection.parse(input2);
if (result2.result._tag === "Left") {
  const formatter = new ErrorFormatter("ansi");
  console.log(formatter.format(result2.result.left));
} else {
  console.log("Success:");
  console.log("Section name:", result2.result.right.name);
  console.log("Properties:", Object.fromEntries(result2.result.right.properties));
}

console.log("\n=== Test 3: Original failing input (malformed) ===");
const input3 = "[database\nhost=localhost";
const result3 = iniSection.parse(input3);
if (result3.result._tag === "Left") {
  const formatter = new ErrorFormatter("ansi");
  console.log("Expected error (missing closing bracket):");
  console.log(formatter.format(result3.result.left));
} else {
  console.log("Unexpected success:", result3.result.right);
}

console.log("\n=== Test 4: Section with whitespace ===");
const input4 = `[ cache ]
enabled = true
ttl = 3600`;

const result4 = iniSection.parse(input4);
if (result4.result._tag === "Left") {
  const formatter = new ErrorFormatter("ansi");
  console.log(formatter.format(result4.result.left));
} else {
  console.log("Success:");
  console.log("Section name:", result4.result.right.name);
  console.log("Properties:", Object.fromEntries(result4.result.right.properties));
}

// Analysis: Missing features compared to Megaparsec Haskell version
console.log("\n=== Missing Features Analysis ===");
console.log("Compared to the Haskell Megaparsec INI parser, parserator is missing:");
console.log("1. takeWhile/takeWhile1 combinators for character-based parsing");
console.log("2. skipLineComment combinator for handling ; and # comments");
console.log("3. lexeme combinator for automatic trailing whitespace handling");
console.log("4. notFollowedBy combinator for lookahead without consumption");
console.log("5. Built-in space consumer with comment support");
console.log("6. eof combinator to ensure complete input consumption");
console.log("7. Multiple section parsing with proper section separation");
console.log("8. Text trimming utilities integrated with parsing");
