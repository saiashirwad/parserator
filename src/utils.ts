import { makeParser, replySuccess } from "./parser.ts"
import { State, type ParserState } from "./state.ts"

export const peekState = makeParser(state => replySuccess(state, state))
export const peekRemaining = makeParser(state =>
  replySuccess(State.remaining(state), state)
)
export const peekAhead = (n: number) =>
  makeParser(state => replySuccess(State.peek(state, n), state))
export const peekLine = makeParser(state => {
  const remaining = State.remaining(state)
  const index = remaining.search(/[\r\n]/)
  return replySuccess(index < 0 ? remaining : remaining.slice(0, index), state)
})
export const peekUntil = (delimiter: string) =>
  makeParser((state: ParserState) => {
    const remaining = State.remaining(state)
    const index = remaining.indexOf(delimiter)
    return replySuccess(
      index < 0 ? remaining : remaining.slice(0, index),
      state
    )
  })

type Narrowed<T> = T extends readonly unknown[]
  ? [...T]
  : T extends Record<string, unknown>
    ? { -readonly [K in keyof T]: Narrowed<T[K]> }
    : T
export function narrow<const T>(value: T): Narrowed<T> {
  return value as Narrowed<T>
}
