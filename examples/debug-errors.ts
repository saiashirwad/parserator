// import {
//   Parser,
//   commit,
//   char,
//   or,
//   many,
//   eof,
//   Either,
//   ErrorFormatter,
//   regex,
//   string,
//   optional
// } from "../src";

// const formatter = new ErrorFormatter("ansi");

// // Define basic parsers
// const whitespace = regex(/\s+/).label("whitespace");
// const spaces = optional(whitespace);
// const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/).label("identifier");

// // Keyword parser that ensures it's not part of a larger identifier
// const keyword = (k: string) =>
//   string(k).thenDiscard(regex(/(?![a-zA-Z0-9_])/)).label(`keyword '${k}'`);

// // Simple variable declaration parser
// const varDecl = Parser.gen(function* () {
//   const kind = yield* or(keyword("let"), keyword("const"));
//   yield* commit();
//   yield* spaces;
//   const name = yield* identifier.expect("variable name");
//   yield* spaces;
//   yield* char(";");
//   return { kind, name };
// });

// // Test cases
// const testCases = [
//   "let x;",      // Should work
//   "const y;",    // Should work
//   "let ;",       // Should fail with "Expected variable name"
//   "const ;",     // Should fail with "Expected variable name"
//   "let 123;",    // Should fail (number not identifier)
//   "var z;",      // Should fail (var not recognized)
//   "let",         // Should fail (incomplete)
// ];

// console.log("=== Testing Error Propagation ===\n");

// // Test 1: Direct parsing (no many wrapper)
// console.log("--- Test 1: Direct Parser ---");
// for (const input of testCases) {
//   console.log(`Input: "${input}"`);
//   const result = varDecl.parse(input);
//   if (Either.isLeft(result.result)) {
//     console.log("Error:");
//     console.log(formatter.format(result.result.left));
//   } else {
//     console.log("Success:", JSON.stringify(result.result.right));
//   }
//   console.log();
// }

// // Test 2: With many wrapper
// const manyVarDecls = Parser.gen(function* () {
//   const decls = yield* many(varDecl);
//   yield* spaces;
//   yield* eof;
//   return decls;
// });

// console.log("\n--- Test 2: With many() Wrapper ---");
// for (const input of testCases) {
//   console.log(`Input: "${input}"`);
//   const result = manyVarDecls.parse(input);
//   if (Either.isLeft(result.result)) {
//     console.log("Error:");
//     console.log(formatter.format(result.result.left));
//   } else {
//     console.log("Success:", JSON.stringify(result.result.right));
//   }
//   console.log();
// }

// // Test 3: With or wrapper (simulating statement parser)
// const statement = or(
//   varDecl,
//   Parser.error("Not a valid statement")
// );

// const program = Parser.gen(function* () {
//   const stmts = yield* many(statement);
//   yield* spaces;
//   yield* eof;
//   return stmts;
// });

// console.log("\n--- Test 3: With or() and many() ---");
// for (const input of testCases) {
//   console.log(`Input: "${input}"`);
//   const result = program.parse(input);
//   if (Either.isLeft(result.result)) {
//     console.log("Error:");
//     console.log(formatter.format(result.result.left));
//   } else {
//     console.log("Success:", JSON.stringify(result.result.right));
//   }
//   console.log();
// }

// // Test 4: Fatal error test
// const fatalVarDecl = Parser.gen(function* () {
//   const kind = yield* or(keyword("let"), keyword("const"));
//   yield* commit();
//   yield* spaces;

//   // Check if we have a semicolon immediately (missing name)
//   const nextChar = yield* Parser.lazy(() => char(";").map(() => true).or(Parser.succeed(false)));
//   if (nextChar) {
//     return yield* Parser.fatal(`Missing variable name after '${kind}'`);
//   }

//   const name = yield* identifier.expect("variable name");
//   yield* spaces;
//   yield* char(";");
//   return { kind, name };
// });

// console.log("\n--- Test 4: With Fatal Errors ---");
// for (const input of ["let ;", "const ;"]) {
//   console.log(`Input: "${input}"`);
//   const result = fatalVarDecl.parse(input);
//   if (Either.isLeft(result.result)) {
//     console.log("Error:");
//     console.log(formatter.format(result.result.left));
//   } else {
//     console.log("Success:", JSON.stringify(result.result.right));
//   }
//   console.log();
// }
