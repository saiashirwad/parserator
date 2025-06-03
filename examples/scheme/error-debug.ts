import { lispParser } from "./parser";
import { ErrorFormatter } from "../../src";

const originalInput = "(+ 5  (+ 3 5)";
console.log("=== ParseErrorBundle Debug ===");
console.log(`Input: "${originalInput}"`);
console.log(`Length: ${originalInput.length}`);

const result = lispParser.parse(originalInput);
if (result.result._tag === "Left") {
  const bundle = result.result.left;

  console.log("\n--- ParseErrorBundle Structure ---");
  console.log("Bundle type:", bundle.constructor.name);
  console.log("Number of errors:", bundle.errors.length);
  console.log("Source length:", bundle.source.length);
  console.log("Source matches input:", bundle.source === originalInput);

  console.log("\n--- Primary Error Analysis ---");
  const primary = bundle.primary;
  console.log("Primary error tag:", primary.tag);
  console.log("Primary error span:", primary.span);
  console.log("Primary error message:", primary.tag === "Custom" ? primary.message : "N/A");
  console.log("Primary error context:", primary.context);

  console.log("\n--- All Errors Analysis ---");
  bundle.errors.forEach((error, i) => {
    console.log(`Error ${i + 1}:`);
    console.log(`  Tag: ${error.tag}`);
    console.log(
      `  Span: offset=${error.span.offset}, length=${error.span.length}, line=${error.span.line}, column=${error.span.column}`
    );
    if (error.tag === "Custom") {
      console.log(`  Message: ${error.message}`);
    } else if (error.tag === "Expected") {
      console.log(`  Expected: ${error.items}`);
    } else if (error.tag === "Unexpected") {
      console.log(`  Found: ${error.found}`);
    }
    console.log(`  Context: [${error.context.join(" > ")}]`);
  });

  console.log("\n--- Position Verification ---");
  const span = primary.span;
  console.log(`Reported position: line ${span.line}, column ${span.column}`);
  console.log(`Reported offset: ${span.offset}`);
  console.log(`Input length: ${originalInput.length}`);
  console.log(`Expected offset: ${originalInput.length} (at end of input)`);
  console.log(`Offset matches expectation: ${span.offset === originalInput.length}`);

  // Manual position calculation
  let line = 1;
  let column = 1;
  for (let i = 0; i < span.offset && i < originalInput.length; i++) {
    if (originalInput[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  console.log(`Manual calculation: line ${line}, column ${column}`);
  console.log(
    `Manual matches reported: line=${line === span.line}, column=${column === span.column}`
  );

  console.log("\n--- ErrorFormatter Output ---");
  const formatter = new ErrorFormatter("ansi");
  const formatted = formatter.format(bundle);
  console.log(formatted);

  console.log("\n--- Character-by-character position map ---");
  console.log("Index: 0123456789012345");
  console.log("       1         2");
  console.log(`Input: ${originalInput}`);
  console.log(`Error: ${" ".repeat(span.offset)}^`);
  console.log(`Should:${" ".repeat(originalInput.length)}^`);
} else {
  console.log("❌ Unexpected success - parser should have failed!");
}
