import { anyKeywordWithHints, char, many0, many1, sequence } from "../src";

const p = sequence([
  many1(char("$")),
  many0(char(".")),
  anyKeywordWithHints(["name", "hi", "typescript"])
]);

const inputs = ["$ha", "$$$..name"] as const;
for (const input of inputs) {
  const result = p.parse(input);
  console.log(
    result.result._tag === "Left" ?
      result.result.left.format("ansi")
    : result.result.right
  );
}
