import {
  atomic,
  char,
  commit,
  Either,
  ErrorFormatter,
  or,
  Parser,
  regex,
  sepBy,
  string
} from "../src";

const number = regex(/[0-9]+/).label("number");
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/).label("identifier");
const whitespace = regex(/\s+/).label("whitespace");
const operator = regex(/[+\-*/]/).label("operator");

console.log("=== ATOMIC PARSER EXAMPLES ===\n");

// Example 1: Without atomic - partial consumption problem
console.log("--- Example 1: Partial Consumption Problem ---");

const nonAtomicParser = or(
  // Try to parse as function call
  Parser.gen(function* () {
    const name = yield* identifier;
    yield* char("(");
    const args = yield* sepBy(number, char(","));
    yield* char(")");
    return { type: "call", name, args };
  }),
  // Try to parse as simple identifier
  identifier.map(name => ({ type: "identifier", name }))
);

// With atomic - clean backtracking
const atomicParser = or(
  // Try to parse as function call (atomically)
  atomic(
    Parser.gen(function* () {
      const name = yield* identifier;
      yield* char("(");
      const args = yield* sepBy(number, char(","));
      yield* char(")");
      return { type: "call", name, args };
    })
  ),
  // Try to parse as simple identifier
  identifier.map(name => ({ type: "identifier", name }))
);

const formatter = new ErrorFormatter("ansi");

// Test case that shows the difference
const testInputs1 = [
  "foo(1,2,3)", // Valid function call
  "foo(1,2", // Incomplete function call - shows the difference
  "bar", // Just an identifier
  "baz()" // Empty function call
];

for (const input of testInputs1) {
  console.log(`\nInput: "${input}"`);

  console.log("Without atomic:");
  const result1 = nonAtomicParser.parse(input);
  if (Either.isLeft(result1.result)) {
    console.log("  Error - remaining input:", `"${result1.state.remaining}"`);
  } else {
    console.log("  Success:", result1.result.right);
  }

  console.log("With atomic:");
  const result2 = atomicParser.parse(input);
  if (Either.isLeft(result2.result)) {
    console.log("  Error - remaining input:", `"${result2.state.remaining}"`);
  } else {
    console.log("  Success:", result2.result.right);
  }
}

// Example 2: Lookahead without consumption
console.log("\n\n--- Example 2: Lookahead Without Consumption ---");

const startsWithOperator = or(
  atomic(or(string("++"), string("--"), string("+="), string("-="), string("+"), string("-"))).map(
    () => true
  ),
  Parser.lift(false)
);

const lookaheadParser = Parser.gen(function* () {
  const hasOp = yield* startsWithOperator;
  const content = yield* regex(/.+/); // Consume the rest
  return { startsWithOperator: hasOp, content };
});

const testInputs2 = ["++ increment", "-- decrement", "+= addition", "hello world", "123 numbers"];

console.log("\nChecking if inputs start with operators:");
for (const input of testInputs2) {
  const result = lookaheadParser.parse(input);
  if (Either.isRight(result.result)) {
    console.log(`"${input}" ->`, result.result.right);
  }
}

// Example 3: Complex expression parsing with atomic alternatives
console.log("\n\n--- Example 3: Complex Expression Parsing ---");

// Try to parse different expression types atomically
const expression: Parser<any> = or(
  // Binary operation (must be atomic to avoid partial consumption)
  atomic(
    Parser.gen(function* () {
      const left = yield* number;
      yield* whitespace;
      const op = yield* operator;
      yield* whitespace;
      const right = yield* number;
      return { type: "binary", left, op, right };
    })
  ),
  // Parenthesized expression
  atomic(
    Parser.gen(function* () {
      yield* char("(");
      const value = yield* number;
      yield* char(")");
      return { type: "grouped", value };
    })
  ),
  // Just a number
  number.map(n => ({ type: "literal", value: n }))
);

const testInputs3 = [
  "42", // Simple number
  "(123)", // Grouped number
  "10 + 20", // Binary operation
  "5 * ", // Incomplete binary - should fall back to literal
  "(50" // Incomplete group - should fall back to literal
];

console.log("\nParsing expressions:");
for (const input of testInputs3) {
  console.log(`\nInput: "${input}"`);
  const result = expression.parse(input);
  if (Either.isLeft(result.result)) {
    console.log("Error:");
    console.log(formatter.format(result.result.left));
  } else {
    console.log("Success:", result.result.right);
  }
}

// Example 4: Atomic with commit
console.log("\n\n--- Example 4: Atomic with Commit ---");

const statement = or(
  // If statement - atomic until we commit
  Parser.gen(function* () {
    // This part is atomic
    const result = yield* atomic(
      Parser.gen(function* () {
        yield* string("if");
        yield* whitespace;
        return true;
      })
    );

    if (result) {
      // Now we commit - no more backtracking
      yield* commit();
      yield* char("(").expect("opening parenthesis after 'if'");
      const condition = yield* identifier;
      yield* char(")").expect("closing parenthesis");
      return { type: "if", condition };
    }

    return null; // Should never reach here
  }),
  // Assignment
  Parser.gen(function* () {
    const name = yield* identifier;
    yield* whitespace;
    yield* char("=");
    yield* whitespace;
    const value = yield* number;
    return { type: "assignment", name, value };
  })
);

const testInputs4 = [
  "if (x)", // Valid if
  "if x", // Missing parens - should give specific error
  "x = 42", // Valid assignment
  "if123 = 5" // Identifier starting with 'if'
];

console.log("\nParsing statements with atomic+commit:");
for (const input of testInputs4) {
  console.log(`\nInput: "${input}"`);
  const result = statement.parse(input);
  if (Either.isLeft(result.result)) {
    console.log("Error:");
    console.log(formatter.format(result.result.left));
  } else {
    console.log("Success:", result.result.right);
  }
}
