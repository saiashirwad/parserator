import { expr, programParser } from "./parser";
import { Either, ErrorFormatter } from "../../src";

const formatter = new ErrorFormatter("ansi");

const testCases = [
  `42`,
  `-123`,
  `3.14`,
  `"hello world"`,
  `'x'`,
  `true`,
  `false`,
  `()`,
  `(1, 2, 3)`,
  `[1; 2; 3]`,
  `1 :: 2 :: []`,
  `x + y`,
  `f x y`,
  `x * y + z`,
  `let x = 1 in x + 1`,
  `let f x = x + 1 in f 5`,
  `let rec fact n = if n = 0 then 1 else n * fact (n - 1) in fact 5`,
  `match x with 0 -> "zero" | _ -> "other"`,
  `match lst with [] -> 0 | h :: t -> 1 + length t`,
  `fun x -> x + 1`,
  `fun x y -> x + y`,
  `function 0 -> "zero" | _ -> "other"`,
  `if x > 0 then "positive" else "non-positive"`,
  `{x = 1; y = 2}`,
  `point.x`,
  `let compose f g x = f (g x) in compose succ pred 5`,
  `(x : int)`,
  `let f (x : int) : int = x + 1 in f 5`
];

const declTestCases = [
  `let x = 42`,
  `let f x = x + 1`,
  `let rec fact n = if n = 0 then 1 else n * fact (n - 1)`,
  `let rec even n = if n = 0 then true else odd (n - 1)
   and odd n = if n = 0 then false else even (n - 1)`,
  `type color = Red | Green | Blue`,
  `type 'a option = None | Some of 'a`,
  `type 'a list = Nil | Cons of 'a * 'a list`,
  `type point = { x : int; y : int }`,
  `type person = { name : string; mutable age : int }`,
  `type coord = int * int`,
  `exception Not_found`,
  `exception Invalid_argument of string`,
  `type 'a option = None | Some of 'a

   let map f opt = match opt with
     | None -> None
     | Some x -> Some (f x)

   let bind opt f = match opt with
     | None -> None
     | Some x -> f x

   let return x = Some x`
];

console.log("=== ToyML Parser Tests ===\n");

console.log("--- Expression Tests ---\n");
for (const code of testCases) {
  console.log(`Input: ${code.replace(/\n/g, "\\n").slice(0, 60)}...`);
  const result = expr.parse(code);

  if (Either.isLeft(result.result)) {
    console.log("Error:");
    console.log(formatter.format(result.result.left));
  } else {
    console.log(
      "Parsed:",
      JSON.stringify(result.result.right, null, 2).slice(0, 200)
    );
  }
  console.log();
}

console.log("\n--- Declaration Tests ---\n");
for (const code of declTestCases) {
  console.log(`Input: ${code.replace(/\n/g, "\\n").slice(0, 60)}...`);
  const result = programParser.parse(code);

  if (Either.isLeft(result.result)) {
    console.log("Error:");
    console.log(formatter.format(result.result.left));
  } else {
    console.log(
      "Parsed:",
      JSON.stringify(result.result.right, null, 2).slice(0, 300)
    );
  }
  console.log();
}
