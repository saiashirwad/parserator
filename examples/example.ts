import { commit, Either, ErrorFormatter, many1, Parser, regex, string } from "../src";

const number = regex(/[0-9]+/);
const spaces = regex(/\s+/);

// const something = parser(function* () {
//   yield* char("[")
//   const elements = yield* many0(
//     parser(function* () {
//       const num = yield* number.withError(() => "Expected number").map(Number)
//       yield* skipMany0(spaces)
//       const comma = yield* optional(char(","))
//       yield* skipMany0(spaces)
//       if (!comma) {
//         const nextChar = yield* peekRemaining
//         if (nextChar !== "]") {
//           return yield* Parser.error("boooo")
//         }
//       }
//       return num
//     })
//   )
//   yield* char("]").withError(() => "Expected ']'")

//   return elements
// })

const exampleParser = Parser.gen(function* () {
  const header = yield* string("BEGIN");
  yield* many1(spaces);
  yield* commit();

  const version = yield* number.map(Number);
  if (version > 2) {
    return yield* Parser.fatal("Version 3+ not supported");
  }

  yield* many1(spaces);
  yield* string("END").withError(() => "Expected 'END'");

  return { header, version };
});

const testCases = ["BEGIN 1 END", "BEGIN 3 END", "BEGIN 3"];

const formatter = new ErrorFormatter("ansi");
for (const testCase of testCases) {
  const result = exampleParser.parse(testCase);
  if (Either.isLeft(result.result)) {
    console.log(formatter.format(result.result.left));
  } else {
    console.log(result.result.right);
  }
}
