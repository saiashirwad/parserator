import { char, digit, many1, parser } from "../src";

const phoneNumber = parser(function* () {
  yield* char("(");
  const areaCode = yield* many1(digit).expect("area code");
  yield* char(")");
  yield* char(" ");
  const exchange = yield* many1(digit).expect("exchange");
  yield* char("-");
  const number = yield* many1(digit).expect("number");

  return `(${areaCode.join("")}) ${exchange.join("")}-${number.join("")}`;
});

const inputs = [
  "(555) 123-4567",
  "(800) 555-1234",
  "(212) 867-5309",
  "555) 123-4567", // missing opening parenthesis
  "(555 123-4567", // missing closing parenthesis
  "(555) 123 4567", // missing dash
  "(abc) 123-4567", // letters in area code
  "(555) abc-4567", // letters in exchange
  "(555) 123-abcd", // letters in number
  "555-123-4567", // wrong format entirely
  "" // empty string
];

for (const input of inputs) {
  const result = phoneNumber.parse(input);
  if (result.result._tag === "Left") {
    console.log(`❌ "${input}"`);
    console.log(result.result.left.format("ansi"));
    console.log();
  } else {
    console.log(`✅ "${input}" → ${result.result.right}`);
  }
}
