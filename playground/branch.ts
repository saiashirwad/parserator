import { Either, ErrorFormatter, parser, Parser, peekAhead, regex } from "../src"

// https://hackage.haskell.org/package/selective

const branch = <A, B, C>(
  mp: Parser<Either<B, A>>,
  ml: Parser<(a: A) => C>,
  mr: Parser<(b: B) => C>
) =>
  mp.flatMap(
    Either.match(
      pLeft => ml.flatMap(l => Parser.lift(l(pLeft))),
      pRight => mr.flatMap(r => Parser.lift(r(pRight)))
    )
  )

const numberParser = regex(/^\d+$/).map(parseInt)
const stringParser = regex(/^[a-zA-Z]+$/)

const branchedParser = branch(
  parser(function* () {
    const firstChar = yield* peekAhead(1)
    if (Number.isInteger(Number(firstChar))) {
      return yield* Parser.selectRight(numberParser)
    }
    return yield* Parser.selectLeft(stringParser)
  }),
  Parser.lift(a => `String: ${a.toUpperCase()}`),
  Parser.lift(b => `Number: ${b}`)
)

const result = branchedParser.parse("234")

if (result.result._tag === "Left") {
  const error = result.result.left
  const formatter = new ErrorFormatter("ansi")
  console.log(formatter.format(error))
} else {
  const value = result.result.right
  console.log(value)
}
