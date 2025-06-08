import { alphabet, char, digit, many1, or, parser, sepBy1 } from "../src";

const email = parser(function* () {
  const username = yield* many1(or(alphabet, digit, char("."))).expect(
    "username"
  );
  yield* char("@").expect("@");
  const domain = yield* many1(or(alphabet, digit))
    .map(chars => chars.join(""))
    .expect("domain name");
  yield* char(".").expect(".");
  // For simplicity, we will not parse the full domain name here.
  // In a complete implementation, you would typically parse the domain name
  const tld = yield* many1(alphabet)
    .map(chars => chars.join(""))
    .expect("top-level domain (TLD)");

  return { username: username.join(""), domain: domain + "." + tld };
});

const inputs = [
  "john.doe@example.com",
  "jane.doe@example.org",
  "invalid-email@.com",
  "something.com",
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
