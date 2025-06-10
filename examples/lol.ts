import { char, ErrorFormatter, many, parser, position } from "../src";

const something = parser(function* () {
  const pos = yield* position;
  const [a, aSpan] = yield* many(char("a"))
    .map(x => x.join(""))
    .spanned();
  const [b, bSpan] = yield* char("b").spanned();

  return { a, b, aSpan, bSpan, pos };
});

const result = something.parse("aaaa");
if (result.result._tag === "Left") {
  console.log(new ErrorFormatter("html").format(result.result.left));
  console.log();
  console.log(new ErrorFormatter("ansi").format(result.result.left));
  console.log();
  console.log(JSON.stringify(result.result.left, null, 2));
}
