import { char, commit, Either, ErrorFormatter, many1, or, Parser, regex, string } from "../src";

const number = regex(/[0-9]+/).label("number");
const spaces = regex(/\s+/).label("whitespace");
const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/).label("identifier");

const statementWithoutCommit = or(
  Parser.gen(function* () {
    yield* string("if");
    yield* spaces;
    yield* char("(");
    const condition = yield* identifier;
    yield* char(")");
    return { type: "if", condition };
  }),
  Parser.gen(function* () {
    yield* string("while");
    yield* spaces;
    yield* char("(");
    const condition = yield* identifier;
    yield* char(")");
    return { type: "while", condition };
  }),
  Parser.gen(function* () {
    const name = yield* identifier;
    yield* spaces;
    yield* char("=");
    yield* spaces;
    const value = yield* number;
    return { type: "assignment", name, value };
  })
);

// Example 2: With commit - specific error messages
const statementWithCommit = or(
  Parser.gen(function* () {
    yield* string("if");
    yield* commit(); // After seeing "if", we're committed to parsing an if statement
    yield* spaces.expect("whitespace after 'if'");
    yield* char("(").expect("opening parenthesis after 'if'");
    const condition = yield* identifier.expect("condition expression");
    yield* char(")").expect("closing parenthesis");
    return { type: "if", condition };
  }),
  Parser.gen(function* () {
    yield* string("while");
    yield* commit(); // After seeing "while", we're committed to parsing a while statement
    yield* spaces.expect("whitespace after 'while'");
    yield* char("(").expect("opening parenthesis after 'while'");
    const condition = yield* identifier.expect("condition expression");
    yield* char(")").expect("closing parenthesis");
    return { type: "while", condition };
  }),
  Parser.gen(function* () {
    const name = yield* identifier;
    yield* spaces;
    yield* char("=");
    yield* commit(); // After seeing "name =", we're committed to parsing an assignment
    yield* spaces.expect("whitespace after '='");
    const value = yield* number.expect("numeric value");
    return { type: "assignment", name, value };
  })
);

console.log("=== EXAMPLE 1: Without Commit ===");
const testCases1 = [
  "if (x)", // Valid
  "if x)", // Missing opening paren
  "while (y)", // Valid
  "while y)", // Missing opening paren
  "z = 42", // Valid
  "invalid input" // Completely invalid
];

const formatter = new ErrorFormatter("ansi");
for (const input of testCases1) {
  console.log(`\nInput: "${input}"`);
  const result = statementWithoutCommit.parse(input);
  if (Either.isLeft(result.result)) {
    console.log("Error (without commit):");
    console.log(formatter.format(result.result.left));
  } else {
    console.log("Success:", result.result.right);
  }
}

console.log("\n\n=== EXAMPLE 2: With Commit ===");
const testCases2 = [
  "if (x)", // Valid
  "if x)", // Missing opening paren - specific error!
  "while (y)", // Valid
  "while y)", // Missing opening paren - specific error!
  "z = ", // Missing value - specific error!
  "invalid input" // Completely invalid - generic error
];

for (const input of testCases2) {
  console.log(`\nInput: "${input}"`);
  const result = statementWithCommit.parse(input);
  if (Either.isLeft(result.result)) {
    console.log("Error (with commit):");
    console.log(formatter.format(result.result.left));
  } else {
    console.log("Success:", result.result.right);
  }
}
