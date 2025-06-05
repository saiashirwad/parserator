import { anyKeywordWithHints, char, many1 } from "../src";

const lol = many1(char("$")).zip(
  anyKeywordWithHints(["name", "hi", "typescript"])
);

const inputs = ["$ha", "$$$$nome"];
for (const input of inputs) {
  const result = lol.parse(input);
  console.log(
    result.result._tag === "Left" ?
      result.result.left.format("ansi")
    : result.result.right
  );
}
