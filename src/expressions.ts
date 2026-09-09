import { choice, many } from "./combinators.ts"
import {
  makeResumable,
  parser,
  replySuccess,
  runResumable,
  type Parser
} from "./parser.ts"
import type { ParserReply } from "./state.ts"

export type BinaryOperator<T> = Parser<(left: T, right: T) => T>
export type UnaryOperator<T> = Parser<(value: T) => T>

/** Parse one or more terms, folding operators from left to right. */
export function chainLeft1<T>(
  term: Parser<T>,
  operator: BinaryOperator<T>
): Parser<T> {
  return makeResumable(function* (state) {
    const first = yield* runResumable(term, state)
    if (!first.result.ok) return first

    let value = first.result.value
    let current = first.state
    while (true) {
      const operation = yield* runResumable(operator, current)
      if (!operation.result.ok) {
        const control = operation.result.failure.control
        if (
          control.kind === "fatal" ||
          control.cutGeneration > current.cutGeneration
        ) {
          return operation as ParserReply<never> as ParserReply<T>
        }
        return replySuccess(value, current)
      }

      const right = yield* runResumable(term, operation.state)
      if (!right.result.ok) {
        return right as ParserReply<never> as ParserReply<T>
      }
      if (right.state.offset <= current.offset) {
        throw new Error("expression operator and term must consume input")
      }
      value = operation.result.value(value, right.result.value)
      current = right.state
    }
  })
}

/** Parse one or more terms, folding operators from right to left. */
export function chainRight1<T>(
  term: Parser<T>,
  operator: BinaryOperator<T>
): Parser<T> {
  return makeResumable(function* (state) {
    const first = yield* runResumable(term, state)
    if (!first.result.ok) return first

    const values = [first.result.value]
    const operations: Array<(left: T, right: T) => T> = []
    let current = first.state
    while (true) {
      const operation = yield* runResumable(operator, current)
      if (!operation.result.ok) {
        const control = operation.result.failure.control
        if (
          control.kind === "fatal" ||
          control.cutGeneration > current.cutGeneration
        ) {
          return operation as ParserReply<never> as ParserReply<T>
        }

        let value: T = values[values.length - 1] as T
        for (let index = operations.length - 1; index >= 0; index--) {
          value = operations[index]!(values[index] as T, value)
        }
        return replySuccess(value, current)
      }

      const right = yield* runResumable(term, operation.state)
      if (!right.result.ok) {
        return right as ParserReply<never> as ParserReply<T>
      }
      if (right.state.offset <= current.offset) {
        throw new Error("expression operator and term must consume input")
      }
      operations.push(operation.result.value)
      values.push(right.result.value)
      current = right.state
    }
  })
}

/** Parse zero or more prefix operators and apply them from right to left. */
export function prefix<T>(
  operator: UnaryOperator<T>,
  operand: Parser<T>
): Parser<T> {
  return parser(function* () {
    const operators = yield* many(operator)
    let value = yield* operand
    for (let index = operators.length - 1; index >= 0; index--) {
      value = operators[index]!(value)
    }
    return value
  })
}

/** Parse zero or more postfix operators and apply them from left to right. */
export function postfix<T>(
  operand: Parser<T>,
  operator: UnaryOperator<T>
): Parser<T> {
  return parser(function* () {
    let value = yield* operand
    const operators = yield* many(operator)
    for (const operation of operators) value = operation(value)
    return value
  })
}

export type PrecedenceOperator<T> =
  | BinaryOperator<T>
  | readonly [Parser<unknown>, (left: T, right: T) => T]

export type PrecedenceLevel<T> = {
  readonly associativity: "left" | "right"
  readonly operators: readonly PrecedenceOperator<T>[]
}

function operatorParser<T>(
  operators: readonly PrecedenceOperator<T>[]
): BinaryOperator<T> {
  if (operators.length === 0) {
    throw new TypeError("precedence levels need at least one operator")
  }
  const parsers = operators.map(operator => {
    if (Array.isArray(operator)) {
      return operator[0].map(() => operator[1])
    }
    return operator
  })
  return choice(...(parsers as [BinaryOperator<T>, ...BinaryOperator<T>[]]))
}

/**
 * Builds an expression parser from high-to-low precedence levels.
 * Operators may already return a binary function, or be supplied as
 * `[parser, combine]` pairs.
 */
export function precedence<T>(
  atom: Parser<T>,
  levels: readonly PrecedenceLevel<T>[]
): Parser<T> {
  let current = atom
  for (const level of levels) {
    const operator = operatorParser(level.operators)
    current =
      level.associativity === "left"
        ? chainLeft1(current, operator)
        : chainRight1(current, operator)
  }
  return current
}
