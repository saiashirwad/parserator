import { alphabet, char, digit, many1, or, parser, sepBy1 } from "../src";

const email = parser(function* () {
  const username = yield* many1(or(alphabet, digit, char("."))).expect(
    "username"
  );
  yield* char("@").expect("at symbol '@'");

  const domain = yield* sepBy1(many1(or(alphabet, digit)), char("."))
    .map(parts => parts.map(chars => chars.join("")).join("."))
    .expect("domain name");
  return { username: username.join(""), domain };
});

const inputs = [
  "john.doe@example.com",
  "jane.doe@example.org",
  "invalid-email@.com",
  "user@domain..com",
  "user@.com"
];

for (const input of inputs) {
  const result = email.parse(input);
  if (result.result._tag === "Left") {
    console.log(result.result.left.format("ansi"));
  } else {
    console.log(result.result.right);
  }
}
