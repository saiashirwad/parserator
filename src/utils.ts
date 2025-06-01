import { Parser } from "./parser"

export const peekState = new Parser(s => {
  return Parser.succeed(s, s)
})

export const peekRemaining = new Parser(s => {
  console.log(s.remaining)
  return Parser.succeed(s.remaining, s)
})

export const peekAhead = (n: number) =>
  new Parser(s => {
    return Parser.succeed(s.remaining.slice(0, n), s)
  })

export const peekLine = new Parser(s => {
  const restOfLine = s.remaining.slice(0, s.remaining.indexOf("\n"))
  console.log(restOfLine)
  return Parser.succeed(restOfLine, s)
})

export const peekUntil = (ch: string) =>
  new Parser(s => {
    const index = s.remaining.indexOf(ch)
    return Parser.succeed(s.remaining.slice(0, index), s)
  })
