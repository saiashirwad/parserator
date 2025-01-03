import { Parser } from "./parser"
import type { SourcePosition } from "./state"

export const peekState = new Parser((s) => {
	console.log(s)
	return Parser.succeed(undefined, s)
})

export const peekRemaining = new Parser((s) => {
	console.log(s.remaining)
	return Parser.succeed(s.remaining, s)
})

export const peekAhead = (n: number) =>
	new Parser((s) => {
		return Parser.succeed(s.remaining.slice(0, n), s)
	})

export const peekLine = new Parser((s) => {
	const restOfLine = s.remaining.slice(
		0,
		s.remaining.indexOf("\n"),
	)
	console.log(restOfLine)
	return Parser.succeed(restOfLine, s)
})

export function printPosition(position: SourcePosition) {
	return `line ${position.line}, column ${position.column}, offset ${position.offset}`
}
