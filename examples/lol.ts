import { char, many, narrow, parser, position } from "../src";

const something = parser(function* () {
  const pos = yield* position;
  const a = yield* many(char("a"))
    .map(x => x.join(""))
    .spanned();
  const [b, bSpan] = yield* char("b").spanned();

  return narrow({ a, b: [b, bSpan] });
});

const result = something.parse("aaaab");
console.log(result.result._tag === "Right" && result.result.right);
