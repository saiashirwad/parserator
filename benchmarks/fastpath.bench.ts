import { bench, run } from "./setup";
import { Parser, char } from "../src";
import { State } from "../src/state";
import { Either } from "../src/either";

const input = "a".repeat(1000);

// Current implementation
const charParser = char("a");

// Fast-path implementation (mutable, no allocations)
function fastChar(
  ch: string,
  state: { offset: number },
  source: string
): boolean {
  if (source[state.offset] === ch) {
    state.offset++;
    return true;
  }
  return false;
}

bench("current char parser", () => {
  let state = State.fromInput(input);
  for (let i = 0; i < 1000; i++) {
    const result = charParser.run(state);
    if (result.result._tag === "Right") {
      state = result.state;
    }
  }
});

bench("fast-path char (mutable)", () => {
  const state = { offset: 0 };
  for (let i = 0; i < 1000; i++) {
    fastChar("a", state, input);
  }
});

await run();
