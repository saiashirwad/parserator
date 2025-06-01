import { ParserError } from "../../src"
import { lispParser } from "./parser"

const program = `(+ 5 (+ 3 5))`

const result = lispParser.parseOrError(program)
if (result instanceof ParserError) {
  console.error(result.message)
} else {
  console.log(JSON.stringify(result, null, 2))
}
