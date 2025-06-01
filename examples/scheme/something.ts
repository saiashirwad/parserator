import { Either } from "../../src"

function divide(a: number, b: number): Either<number, "Division by zero"> {
  if (b === 0) {
    return Either.left("Division by zero")
  }
  return Either.right(a / b)
}

const something = () =>
  Either.gen(function* () {
    const first = divide(1, 2)
    const a = yield* divide(1, 5)
    const b = yield* divide(2, 1)
    return { a, b, c: a + b }
  })

const sdf = Either.right(2)

console.log(something())
