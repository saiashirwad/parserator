import { alphabet, char, digit, many1, or, parser, sepBy1 } from "../src";

const email = parser(function* () {
  const username = yield* many1(or(alphabet, digit, char(".")));
  yield* char("@");
  const domain = yield* sepBy1(many1(alphabet), char(".")).map(parts =>
    parts.map(part => part.join("")).join(".")
  );
  return { username: username.join(""), domain };
});

const inputs = ["john.doe@example.com", "jane.doe@example.org"];

for (const input of inputs) {
  const result = email.parse(input);
  if (result.result._tag === "Left") {
    console.log(result.result.left.format("ansi"));
  } else {
    console.log(result.result.right);
  }
}
