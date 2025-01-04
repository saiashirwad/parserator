import type {
	ParserError,
	ParserState,
	SourcePosition,
} from "./state"

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
	message?: string,
) {
	return (
		printLastNLines(error.state, 3) +
		"\n" +
		printArrow(error.state.pos) +
		`${message ? `\n${message}` : ""}`
	)
}

export function printLastNLines(
	state: ParserState,
	n: number,
) {
	const lines = state.context.source.split("\n").slice(-n)
	const withNumbers = lines.map((line, i) => {
		const lineNumber =
			state.context.source.split("\n").length - n + i + 1
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
	const errorLine = state.context.source.slice(
		error.state.pos.offset,
		state.context.source.indexOf(
			"\n",
			error.state.pos.offset,
		),
	)
	return errorLine
}
