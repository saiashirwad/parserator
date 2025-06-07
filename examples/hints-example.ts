import {
  anyKeywordWithHints,
  char,
  Either,
  many0,
  many1,
  sequence
} from "../src";

const nTh: <const N extends number, const Arr extends any[]>(
  n: N
) => (arr: Arr) => Arr[N] = n => arr => arr[n];

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

const haha = Either.gen(function* () {
  const a = yield* Either.left<string, number>("hi");
  const b = yield* Either.right("hi");

  return { a, b };
});
