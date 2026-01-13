import { bench, run } from "./setup";
import { Parser, char, string } from "../src";

const input = "a".repeat(1000);

bench("char parser (1000 chars)", () => {
  let state = { source: input, offset: 0, line: 1, column: 1 };
  for (let i = 0; i < 1000; i++) {
    const parser = char("a");
    const result = parser.run(state);
    if (result.result._tag === "Right") {
      state = result.state;
    }
  }
});

bench("direct state manipulation", () => {
  let offset = 0;
  for (let i = 0; i < 1000; i++) {
    if (input[offset] === "a") {
      offset++;
    }
  }
});

await run();
