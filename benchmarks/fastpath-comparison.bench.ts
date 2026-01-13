import { bench, group, run } from "mitata";
import { char, string } from "../src/combinators";
import { parser } from "../src/parser";

const input = "hello world".repeat(100);

const helloParser = parser(function* () {
  yield* string("hello");
  yield* char(" ");
  yield* string("world");
  return "parsed";
});

group("Fast-path vs Slow-path", () => {
  bench("slow-path (parse)", () => {
    for (let i = 0; i < 100; i++) {
      helloParser.parse(input);
    }
  });

  bench("fast-path (parseFast)", () => {
    for (let i = 0; i < 100; i++) {
      helloParser.parseFast(input);
    }
  });
});

await run();
