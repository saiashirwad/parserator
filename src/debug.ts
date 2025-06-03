import { Either } from "./either";
import { Parser } from "./parser";
import { type ParserOutput, type ParserState, State } from "./state";
/**
 * Creates a debug output for a parser's current state and result
 */
export function debugState<Ctx = {}>(
  label: string,
  state: ParserState<Ctx>,
  result: ParserOutput<any, Ctx>,
  options: { inputPreviewLength?: number; separator?: string } = {}
) {
  const { inputPreviewLength = 20, separator = "=".repeat(40) } = options;

  console.log(`\n=== ${label} ===`);
  console.log("Position:", State.printPosition(state));
  console.log(
    "Input:",
    JSON.stringify(
      state.remaining.slice(0, inputPreviewLength) +
        (state.remaining.length > inputPreviewLength ? "..." : "")
    )
  );
  console.log(
    "Result:",
    Either.isRight(result.result) ?
      `Success: ${JSON.stringify(result.result.right.value)}`
    : `Error: ${
        result.result.left.primary.tag === "Custom" ?
          result.result.left.primary.message
        : `${result.result.left.primary.tag}: ${JSON.stringify(result.result.left.primary)}`
      }`
  );
  console.log(separator);
}

/**
 * Adds debug output to a parser
 */
export function debug<T, Ctx = {}>(parser: Parser<T, Ctx>, label: string): Parser<T, Ctx> {
  return parser.tap(({ state, result }) => debugState(label, state, result));
}

/**
 * Creates a parser that logs its input state and continues
 */
export function trace<Ctx = {}>(label: string): Parser<void, Ctx> {
  return new Parser(state => {
    console.log(`\n[TRACE] ${label}`);
    console.log("Position:", State.printPosition(state));
    console.log("Remaining:", JSON.stringify(state.remaining));
    return Parser.succeed(undefined, state);
  });
}

/**
 * Adds breakpoints to a parser for step-by-step debugging
 */
export function breakpoint<T, Ctx = {}>(parser: Parser<T, Ctx>, label: string): Parser<T, Ctx> {
  return parser.tap(({ state, result }) => {
    debugState(label, state, result);
    // eslint-disable-next-line no-debugger
    debugger;
  });
}

/**
 * Times how long a parser takes to run
 */
export function benchmark<T, Ctx = {}>(parser: Parser<T, Ctx>, label: string): Parser<T, Ctx> {
  return new Parser(state => {
    const start = performance.now();
    const result = parser.run(state);
    const end = performance.now();
    console.log(`\n[BENCHMARK] ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  });
}
