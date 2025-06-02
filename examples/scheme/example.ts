import { ErrorFormatter } from "../../src"
import { lispParser } from "./parser"

const program = `(+ 5  (+ 3 5)`

const result = lispParser.parse(program)
if (result.result._tag === "Left") {
  const error = result.result.left
  const formatter = new ErrorFormatter("json")
  console.log(formatter.format(error))
}
