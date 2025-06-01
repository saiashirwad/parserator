import { char, string, parser, ErrorFormatter, many1, takeUpto } from "../src"

const iniParser = parser(function* () {
  yield* char("[")
  const value = yield* takeUpto(
    string("]\n").withError(() => "Missing closing bracket ']'")
  )
  yield* char("]")
  yield* char("\n")
  return
})

const input = "[database\nhost=localhost"

const result = iniParser.parse(input)
if (result.result._tag === "Left") {
  const formatter = new ErrorFormatter("ansi")
  console.log(formatter.format(result.result.left))
} else {
  console.log("Success:", result.result.right)
}
