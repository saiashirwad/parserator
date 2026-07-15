import { Either, ErrorFormatter, Parser } from "../src/index.ts"
import { dollarKeyword } from "./hints-example.ts"
import { iniFile } from "./ini-parser.ts"
import { json } from "./json-parser.ts"
import { program as jsProgram } from "./js-parser.ts"
import { program as schemeProgram } from "./scheme-parser.ts"
import {
  expr as toymlExpr,
  programParser as toymlProgram
} from "./toyml/parser.ts"

const formatter = new ErrorFormatter("ansi")

function truncate(s: string, max = 200): string {
  return s.length > max ? `${s.slice(0, max)}...` : s
}

function demo<T>(title: string, p: Parser<T>, inputs: string[]) {
  console.log(`=== ${title} ===\n`)

  for (const input of inputs) {
    console.log(`Input: ${truncate(input.replace(/\n\s*/g, " "), 60)}`)
    const { result } = p.parse(input)

    if (Either.isLeft(result)) {
      console.log(formatter.format(result.left))
    } else {
      console.log("Parsed:", truncate(JSON.stringify(result.right)))
    }
    console.log()
  }
}

demo("JSON", json, [
  `{
    "name": "parserator",
    "numbers": [1, 2, 4.5, -6.7e-8],
    "nested": { "bool": true, "null": null, "string": "hello \\"world\\"" }
  }`,
  `{ "unterminated": "oops }`
])

demo("INI", iniFile, [
  `[database]
   host = localhost
   port = 5432
   ; This is a comment
   password = secret123

   [cache]
   enabled = true
   # Another comment style`,
  `[unclosed
   key = value`
])

demo("Keyword Hints", dollarKeyword, [`$$$..name`, `$ha`])

demo("JavaScript", jsProgram, [
  `let x = 42;`,
  `function greet(name) { return "Hello, " + name; }`,
  `if (x > 0) { console.log(x); }`,
  `const mixed = { a: 1, b, c: fn(x, y) };`,
  `const val = obj.prop.method();`,
  `const x;`,
  `if x > 0 { }`,
  `let if = 10;`,
  `return 42`
])

demo("Scheme", schemeProgram, [
  `(+ (* 2 3) 4)`,
  `(lambda (x y) (+ x y))`,
  `(let ((factorial (lambda (n)
                      (if (= n 0)
                          1
                          (* n (factorial (- n 1)))))))
     (factorial 5))`,
  `; comments work too
   (if #t "yes" "no")`,
  `(lambda x)`,
  `"unterminated string`,
  `(unclosed list`
])

demo("ToyML Expressions", toymlExpr, [
  `let rec fact n = if n = 0 then 1 else n * fact (n - 1) in fact 5`,
  `match lst with [] -> 0 | h :: t -> 1 + length t`,
  `fun x y -> x + y`,
  `{x = 1; y = 2}`,
  `if x > 0 else "negative"`,
  `let x = 1 x + 1`,
  `match x with | 0 "zero"`
])

demo("ToyML Declarations", toymlProgram, [
  `type 'a option = None | Some of 'a

   let map f opt = match opt with
     | None -> None
     | Some x -> Some (f x)`,
  `type person = { name : string; mutable age : int }`,
  `exception Invalid_argument of string`,
  `type foo =`,
  `type foo = { x : }`
])
