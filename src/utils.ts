import { succeed } from "./functions"
import { Parser } from "./parser"

export const peekState = new Parser((s) => {
	return succeed(s, s)
})

export const peekRemaining = new Parser((s) => {
	console.log(s.remaining)
	return succeed(s.remaining, s)
})

export const peekAhead = (n: number) =>
	new Parser((s) => {
		return succeed(s.remaining.slice(0, n), s)
	})

export const peekLine = new Parser((s) => {
	const restOfLine = s.remaining.slice(0, s.remaining.indexOf("\n"))
	console.log(restOfLine)
	return succeed(restOfLine, s)
})

export const peekUntil = (ch: string) =>
	new Parser((s) => {
		const index = s.remaining.indexOf(ch)
		return succeed(s.remaining.slice(0, index), s)
	})
