import { expr, programParser } from "./parser";
import { Either, ErrorFormatter } from "../../src";

const formatter = new ErrorFormatter("ansi");

const errorCases = [
  { code: `if x > 0 else "negative"`, desc: "Missing 'then' keyword" },
  { code: `let x = 1 x + 1`, desc: "Missing 'in' keyword" },
  { code: `"hello world`, desc: "Unclosed string literal" },
  { code: `'ab`, desc: "Invalid char literal" },
  { code: `match x 0 -> "zero"`, desc: "Missing 'with' keyword" },
  { code: `match x with`, desc: "Match with no cases" },
  { code: `fun -> x`, desc: "Fun with no parameters" },
  { code: `let if = 5`, desc: "Reserved keyword as identifier" },
  { code: `let match = 10`, desc: "Another reserved keyword" },
  { code: `[1; 2; 3`, desc: "Unclosed list bracket" },
  { code: `{x = 1; y = 2`, desc: "Unclosed record brace" },
  { code: `(1, 2, 3`, desc: "Unclosed tuple paren" },
  { code: `let x 42 in x`, desc: "Missing '=' in let binding" },
  { code: `let rec = 5`, desc: "Missing function name after rec" },
  { code: `fun x y z`, desc: "Missing '->' in fun expression" },
  { code: `if true then 1`, desc: "Missing 'else' branch" },
  { code: `match x with | 0 "zero"`, desc: "Missing '->' in match case" },
  { code: `{ x = ; y = 2 }`, desc: "Missing value in record field" },
  { code: `let f x : = x`, desc: "Missing type after colon" }
];

const declErrorCases = [
  { code: `type`, desc: "Incomplete type declaration" },
  { code: `type foo =`, desc: "Missing type body" },
  { code: `type foo = { x : }`, desc: "Missing field type in record" },
  { code: `type foo = |`, desc: "Empty variant" },
  { code: `exception`, desc: "Missing exception name" },
  { code: `let`, desc: "Incomplete let declaration" },
  { code: `let rec`, desc: "Incomplete recursive let" },
  { code: `type 'a = Foo`, desc: "Missing type name" }
];

function showError(desc: string, code: string, isMultiline = false) {
  console.log(`\n${desc}`);
  if (isMultiline) {
    console.log("Input:");
    code.split("\n").forEach(line => console.log(`  ${line}`));
  } else {
    console.log(`Input: ${code}`);
  }
  console.log();
}

console.log("ToyML Parser Error Messages Demo");
console.log("=================================\n");

console.log("EXPRESSION ERRORS");
console.log("-----------------");

for (const { code, desc } of errorCases) {
  showError(desc, code);
  const result = expr.parse(code);

  if (Either.isLeft(result.result)) {
    console.log(formatter.format(result.result.left));
  } else {
    console.log("  (parsed successfully - not an error case)");
  }
}

console.log("\n\nDECLARATION ERRORS");
console.log("------------------");

for (const { code, desc } of declErrorCases) {
  showError(desc, code);
  const result = programParser.parse(code);

  if (Either.isLeft(result.result)) {
    console.log(formatter.format(result.result.left));
  } else {
    console.log("  (parsed successfully - not an error case)");
  }
}

console.log("\n\nMULTILINE EXAMPLES");
console.log("------------------");

const multilineErrors = [
  {
    desc: "Unclosed function body",
    code: `let f x =
  if x > 0 then
    x + 1
  else`
  },
  {
    desc: "Missing match arm body",
    code: `match x with
| 0 -> "zero"
| 1 ->
| _ -> "other"`
  },
  {
    desc: "Bad nested let",
    code: `let outer =
  let inner = 42
  inner + 1
in outer`
  }
];

for (const { code, desc } of multilineErrors) {
  showError(desc, code, true);
  const result = expr.parse(code);

  if (Either.isLeft(result.result)) {
    console.log(formatter.format(result.result.left));
  } else {
    console.log("  (parsed successfully - not an error case)");
  }
}
