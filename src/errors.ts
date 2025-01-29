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
		printErrorLine(state) +
		"\n" +
		printArrow(state.pos) +
		`${message ? `\n${message}` : ""}`
	)
}

export function printErrorLine<Ctx = {}>(state: ParserState<Ctx>) {
	const lines = state.context.source.split("\n")
	const lineNum = state.pos.line
	const startLine = Math.max(0, lineNum - 1)
	const endLine = lineNum
	const relevantLines = lines.slice(startLine, endLine + 1)
	const padding = lineNum.toString().length

	return relevantLines
		.map((line, i) => {
			const num = startLine + i + 1
			const paddedNum = num.toString().padStart(padding, " ")
			return `${paddedNum} | ${line}`
		})
		.join("\n")
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
