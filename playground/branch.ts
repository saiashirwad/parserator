import {
  Either,
  ErrorFormatter,
  parser,
  Parser,
  peekAhead,
  regex
} from "../src"

// https://hackage.haskell.org/package/selective

const branch = <A, B, C>(
  mp: Parser<Either<B, A>>,
  ml: Parser<(a: A) => C>,
  mr: Parser<(b: B) => C>
): Parser<C, {}> =>
  mp.flatMap(
    Either.match({
      onLeft: pLeft => ml.flatMap(l => Parser.lift(l(pLeft))),
      onRight: pRight => mr.flatMap(r => Parser.lift(r(pRight)))
    })
  )

const numberParser = regex(/^\d+$/).map(parseInt)
const stringParser = regex(/^[a-zA-Z]+$/)

const branchedParser = branch(
  parser(function* () {
    if (Number.isInteger(Number(yield* peekAhead(1)))) {
      return Either.right(yield* numberParser)
    }
    return Either.left(yield* stringParser)
  }),
  Parser.lift(a => `String: ${a.toUpperCase()}`),
  Parser.lift(b => `Number: ${b}`)
)

// const eitherParser = newParser(function* () {
//   const tryNumber = yield* newParser(function* () {
//     const isNumber = Math.random() > 0.5
//     if (isNumber) {
//       const num = yield* numberParser
//       return Either.right(num)
//     } else {
//       const str = yield* stringParser
//       return Either.left(str)
//     }
//   })
//   return tryNumber
// })

const result = branchedParser.parse("234")
if (result.result._tag === "Left") {
  const error = result.result.left
  const formatter = new ErrorFormatter("ansi")
  console.log(formatter.format(error))
} else {
  const value = result.result.right
  console.log(value)
}

// const haha = Parser.ap(
//   numberParser,
//   Parser.lift(s => `${s}${s}`)
// )

const thing = Parser.liftA2(
  stringParser,
  numberParser,
  (str, num) => [str, num] as const
)

const lol = Parser.lift("hi")

const res = lol.parse("23")
console.log(res.result)

// function branch<A, B, C>(
//   p: Parser<Either<B, A>>,
//   l: Parser<(a: A) => C>,
//   r: Parser<(b: B) => C>
// ): Parser<C> {
//   // return newParser(function* () {
//   //   const p_ = yield* p
//   //   if (Either.isLeft(p_)) {
//   //     return (yield* l)(p_.left)
//   //   } else {
//   //     return (yield* r)(p_.right)
//   //   }
//   // })
// }
