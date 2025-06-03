// import {
//   sepBy,
//   sepBy1,
//   choice,
//   notChar,
//   eof,
//   count,
//   sepEndBy,
//   sequence,
//   many,
//   Parser,
//   string,
//   char,
//   digit,
//   Either,
//   ErrorFormatter
// } from "../src";

// const formatter = new ErrorFormatter("ansi");

// function test(name: string, parser: Parser<any>, inputs: string[]) {
//   console.log(`\n=== ${name} ===`);
//   for (const input of inputs) {
//     const result = parser.parse(input);
//     console.log(`Input: "${input}"`);
//     if (Either.isRight(result.result)) {
//       console.log(`✅ Success:`, JSON.stringify(result.result.right));
//     } else {
//       console.log(`❌ Error:`, result.result.left.primary.message || "Parse failed");
//     }
//   }
// }

// // Test sepBy1
// test("sepBy1 - requires at least one element",
//   sepBy1(digit, char(",")),
//   ["1,2,3", "5", "", "1,2,"]
// );

// // Test choice with array
// test("choice - array of parsers",
//   choice(["let", "const", "var"].map(k => string(k))),
//   ["let", "const", "var", "function", ""]
// );

// // Test notChar
// test("notChar - any character except specified",
//   notChar('"').then(notChar('"')).then(notChar('"')),
//   ["abc", `"ab`, "xyz", `""""`]
// );

// // Test eof
// test("eof - end of input",
//   string("hello").then(eof),
//   ["hello", "hello world", ""]
// );

// // Test count
// test("count - exact number of occurrences",
//   count(3, digit),
//   ["123", "12", "1234", "abc"]
// );

// // Test sepEndBy
// test("sepEndBy - optional trailing separator",
//   sepEndBy(digit, char(",")),
//   ["1,2,3", "1,2,3,", "", "5", "1,"]
// );

// // Test sequence returning all results
// test("sequence - returns all results as tuple",
//   sequence([string("hello"), char(" "), string("world")]),
//   ["hello world", "hello  world", "helloworld"]
// );

// // Test many (alias for many0)
// test("many - zero or more",
//   many(digit),
//   ["123", "", "abc", "1a2"]
// );

// // Complex example using multiple new combinators
// const quotedString = Parser.gen(function* () {
//   yield* char('"');
//   const content = yield* many(notChar('"'));
//   yield* char('"');
//   return content.join('');
// });

// test("Complex: quoted string using notChar",
//   quotedString,
//   [`"hello"`, `"hello world"`, `""`, `"unterminated`, `no quotes`]
// );

// // Test with eof to ensure complete parsing
// const completeNumber = Parser.gen(function* () {
//   const digits = yield* sepBy1(digit, char(","));
//   yield* eof;
//   return digits;
// });

// test("Complete parsing with eof",
//   completeNumber,
//   ["1,2,3", "1,2,3 extra", "123"]
// );

// // Run all tests
// console.log("\n🧪 Testing new combinators...");
