import { Either, ErrorFormatter, parser, Parser, regex } from "../../src"
import { lispParser } from "./parser"

// const program = `(+ 5  (+ a 5)`

// const result = lispParser.parse(program)

// Selective f => f (Either a b) -> f (a -> c) -> f (b -> c) -> f c

function branch<A, B, C>(
  p: Parser<Either<B, A>>,
  l: Parser<(a: A) => C>,
  r: Parser<(b: B) => C>
): Parser<C> {
  return parser(function* () {
    const p_ = yield* p
    if (Either.isLeft(p_)) {
      const b = p_.left
      const bToC = yield* l
      return bToC(b)
    } else {
      const a = p_.right
      const aToC = yield* r
      return aToC(a)
    }
  })
}

const numberParser = regex(/^\d+$/).map(parseInt).label("number")
const stringParser = regex(/^[a-zA-Z]+$/).withError(() => `you made an oopsie`)

const eitherParser = parser(function* () {
  const tryNumber = yield* parser(function* () {
    const isNumber = Math.random() > 0.5
    if (isNumber) {
      const num = yield* numberParser
      return Either.right(num)
    } else {
      const str = yield* stringParser
      return Either.left(str)
    }
  })
  return tryNumber
})

const branchedParser = branch(
  eitherParser,
  parser(function* () {
    return (s: string) => `String: ${s.toUpperCase()}`
  }),
  parser(function* () {
    return (n: number) => `Number: ${n * 2}`
  })
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
