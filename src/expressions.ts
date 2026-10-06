import { many } from "./combinators.ts"
import {
  makeParser,
  combineCut,
  parser,
  replySuccess,
  runParser,
  type Parser
} from "./parser.ts"

export type BinaryOperator<T> = Parser<(left: T, right: T) => T>

export type UnaryOperator<T> = Parser<(value: T) => T>

export function chainLeft1<T>(
  term: Parser<T>,
  operator: BinaryOperator<T>
): Parser<T> {
  return makeParser((source, offset) => {
    const first = runParser(term, source, offset)
    if (!first.ok) return first

    let value = first.value
    let current = first.offset
    let cut = first.cut
    while (true) {
      const operation = runParser(operator, source, current)
      if (!operation.ok) {
        if (operation.fatal || operation.cut) {
          return combineCut(operation, cut)
        }
        return replySuccess(value, current, cut)
      }

      const right = runParser(term, source, operation.offset)
      if (!right.ok) {
        return combineCut(right, cut || operation.cut)
      }
      if (right.offset <= current) {
        throw new Error("expression operator and term must consume input")
      }
      value = operation.value(value, right.value)
      current = right.offset
      cut ||= operation.cut || right.cut
    }
  })
}

export function chainRight1<T>(
  term: Parser<T>,
  operator: BinaryOperator<T>
): Parser<T> {
  return makeParser((source, offset) => {
    const first = runParser(term, source, offset)
    if (!first.ok) return first

    const values = [first.value]
    const operations: Array<(left: T, right: T) => T> = []
    let current = first.offset
    let cut = first.cut
    while (true) {
      const operation = runParser(operator, source, current)
      if (!operation.ok) {
        if (operation.fatal || operation.cut) {
          return combineCut(operation, cut)
        }

        let value: T = values[values.length - 1] as T
        for (let index = operations.length - 1; index >= 0; index--) {
          value = operations[index]!(values[index] as T, value)
        }
        return replySuccess(value, current, cut)
      }

      const right = runParser(term, source, operation.offset)
      if (!right.ok) {
        return combineCut(right, cut || operation.cut)
      }
      if (right.offset <= current) {
        throw new Error("expression operator and term must consume input")
      }
      operations.push(operation.value)
      values.push(right.value)
      current = right.offset
      cut ||= operation.cut || right.cut
    }
  })
}

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

export type PrecedenceLevel<T> = {
  readonly associativity: "left" | "right"
  readonly operator: BinaryOperator<T>
}

export function precedence<T>(
  atom: Parser<T>,
  levels: readonly PrecedenceLevel<T>[]
): Parser<T> {
  let current = atom
  for (const level of levels) {
    current =
      level.associativity === "left"
        ? chainLeft1(current, level.operator)
        : chainRight1(current, level.operator)
  }
  return current
}
