import { parser, char, string, many1, digit, commit } from "../src";

const number = many1(digit).map(digits => parseInt(digits.join("")));
number.parseOrThrow("123"); // → 123

// Parse coordinates like "(10, 20)"
const coordinate = parser(function* () {
  yield* char("(").expect("opening parenthesis '('");
  const x = yield* number;
  yield* string(", ").expect("comma between coordinates");
  const y = yield* number;
  yield* char(")").expect("closing parenthesis ')'");
  return { x, y };
});

const inputs = [
  "(10, 20)",
  "(30, 40)",
  "(50, 60)",
  "(70, 80",
  "90, 100)",
  "(110, 120)abc",
  "abc(130, 140)"
];

for (const input of inputs) {
  const result = coordinate.parse(input);
  if (result.result._tag === "Left") {
    console.log(result.result.left.format("ansi"));
  } else {
    console.log(result.result.right);
  }
}
