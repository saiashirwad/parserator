import { Parser, ParserError } from "./parser"
import type { ParserState, SourcePosition } from "./state"

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
	return `line ${position.line}, column ${position.column}`
}

export function printArrow(position: SourcePosition) {
	const lineNumberDigits = position.line.toString().length
	return (
		" ".repeat(lineNumberDigits + 3 + position.column - 1) +
		"^"
	)
}

export function printErrorContext(
	error: ParserError,
	state: ParserState,
	message?: string,
) {
	return (
		printLastNLines(state, 3) +
		"\n" +
		printArrow(error.pos) +
		`${message ? `\n${message}` : ""}`
	)
}

export function printLastNLines(
	state: ParserState,
	n: number,
) {
	const lines = state.source.split("\n").slice(-n)
	const withNumbers = lines.map((line, i) => {
		const lineNumber =
			state.source.split("\n").length - n + i + 1
		return `${lineNumber} | ${line}`
	})
	return withNumbers.join("\n")
}

export function printPositionWithOffset(
	position: SourcePosition,
) {
	return `line ${position.line}, column ${position.column}, offset ${position.offset}`
}

export function getErrorLine(
	error: ParserError,
	state: ParserState,
) {
	const errorLine = state.source.slice(
		error.pos.offset,
		state.source.indexOf("\n", error.pos.offset),
	)
	return errorLine
}
