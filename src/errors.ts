import type { ParserError, ParserState, SourcePosition } from "./state"

export function printPosition(position: SourcePosition) {
	return `line ${position.line}, column ${position.column}`
}

export function printArrow(position: SourcePosition) {
	const lineNumberDigits = position.line.toString().length
	return " ".repeat(lineNumberDigits + 3 + position.column - 1) + "^"
}

export function printErrorContext<Ctx = {}>(
	state: ParserState<Ctx>,
	message?: string,
) {
	return (
		"Parser Error:\n" +
		printLastNLines(state, 3) +
		"\n" +
		printArrow(state.pos) +
		`${message ? `\n${message}` : ""}`
	)
}

export function printLastNLines<Ctx = {}>(state: ParserState<Ctx>, n: number) {
	const lines = state.context.source.split("\n").slice(-n)
	const withNumbers = lines.map((line, i) => {
		const lineNumber = state.context.source.split("\n").length - n + i + 1
		return `${lineNumber} | ${line}`
	})
	return withNumbers.join("\n")
}

export function printPositionWithOffset(position: SourcePosition) {
	return `line ${position.line}, column ${position.column}, offset ${position.offset}`
}

export function getErrorLine<Ctx = {}>(
	error: ParserError,
	state: ParserState<Ctx>,
) {
	const errorLine = state.context.source.slice(
		state.pos.offset,
		state.context.source.indexOf("\n", state.pos.offset),
	)
	return errorLine
}
