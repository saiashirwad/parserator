import { Parser, char, digit, many1, optional, or, regex } from "../src"

// Basic building blocks
const ws = regex(/\s*/)
const number = many1(digit).map(digits => parseInt(digits.join("")))

const expression: Parser<number> = Parser.gen(function* () {
  let result = yield* term

  while (true) {
    yield* ws
    const op = yield* optional(or(char("+"), char("-")))
    if (!op) break

    yield* ws
    const right = yield* term

    if (op === "+") {
      result = result + right
    } else {
      result = result - right
    }
  }

  return result
})

const term: Parser<number> = Parser.gen(function* () {
  let result = yield* factor

  while (true) {
    yield* ws
    const op = yield* optional(or(char("*"), char("/")))
    if (!op) break

    yield* ws
    const right = yield* factor

    if (op === "*") {
      result = result * right
    } else {
      result = Math.floor(result / right)
    }
  }

  return result
})

const factor: Parser<number> = or(
  // Parenthesized expression
  Parser.gen(function* () {
    yield* char("(")
    yield* ws
    const result = yield* expression
    yield* ws
    yield* char(")")
    return result
  }),
  // Simple number
  number
)

// Test the calculator
console.log(expression.parseOrThrow("2 + 3 *")) // 14
console.log(expression.parseOrThrow("(2 + 3) * 4")) // 20
console.log(expression.parseOrThrow("10 - 2 + 3")) // 11
