import type { Either } from "./either"

export type ParserContext = {
	debug?: boolean
	source: string
}

export type ParserOptions = { name?: string }

export class ParserError {
	constructor(
		public message: string,
		public expected: string[],
		public state: ParserState,
	) {}

	get pos(): SourcePosition {
		return this.state.pos
	}
}

type ParserSuccess<T> = {
	value: T
	state: ParserState
}

export type ParserResult<T> = Either<
	ParserSuccess<T>,
	ParserError
>

export type SourcePosition = {
	line: number
	column: number
	offset: number
}

export type ParserState = {
	remaining: string
	pos: SourcePosition
	context: ParserContext
}

// Add static methods to help create and manipulate parser state
/**
 * Utility object containing static methods for creating and manipulating parser state.
 */
export const State = {
	/**
	 * Creates a new parser state from an input string.
	 *
	 * @param input - The input string to parse
	 * @returns A new parser state initialized at the start of the input
	 */
	fromInput(
		input: string,
		context: ParserContext,
	): ParserState {
		return {
			remaining: input,
			pos: {
				line: 1,
				column: 1,
				offset: 0,
			},
			context,
		}
	},

	/**
	 * Creates a new state by consuming n characters from the current state.
	 *
	 * @param state - The current parser state
	 * @param n - Number of characters to consume
	 * @returns A new state with n characters consumed and position updated
	 * @throws Error if attempting to consume more characters than remaining
	 */
	consume(state: ParserState, n: number): ParserState {
		if (n === 0) return state
		if (n > state.remaining.length) {
			throw new Error(
				"Cannot consume more characters than remaining",
			)
		}

		const consumed = state.remaining.slice(0, n)
		let { line, column, offset } = state.pos

		for (const char of consumed) {
			if (char === "\n") {
				line++
				column = 1
			} else {
				column++
			}
			offset++
		}

		return {
			remaining: state.remaining.slice(n),
			pos: { line, column, offset },
			context: state.context,
		}
	},

	/**
	 * Creates a new state by consuming a specific string from the current state.
	 *
	 * @param state - The current parser state
	 * @param str - The string to consume
	 * @returns A new state with the string consumed and position updated
	 * @throws Error if the input doesn't start with the specified string
	 */
	consumeString(
		state: ParserState,
		str: string,
	): ParserState {
		if (!state.remaining.startsWith(str)) {
			throw new Error(
				`Cannot consume "${str}" - input "${state.remaining}" doesn't start with it`,
			)
		}
		return State.consume(state, str.length)
	},

	/**
	 * Creates a new state by consuming characters while a predicate is true.
	 *
	 * @param state - The current parser state
	 * @param predicate - Function that tests each character
	 * @returns A new state with matching characters consumed
	 */
	consumeWhile(
		state: ParserState,
		predicate: (char: string) => boolean,
	): ParserState {
		let i = 0
		while (
			i < state.remaining.length &&
			predicate(state.remaining[i])
		) {
			i++
		}
		return State.consume(state, i)
	},

	/**
	 * Gets the next n characters from the input without consuming them.
	 *
	 * @param state - The current parser state
	 * @param n - Number of characters to peek (default: 1)
	 * @returns The next n characters as a string
	 */
	peek(state: ParserState, n: number = 1): string {
		return state.remaining.slice(0, n)
	},

	/**
	 * Checks if the parser has reached the end of input.
	 *
	 * @param state - The current parser state
	 * @returns True if at end of input, false otherwise
	 */
	isAtEnd(state: ParserState): boolean {
		return state.remaining.length === 0
	},

	printPosition(state: ParserState): string {
		return `line ${state.pos.line}, column ${state.pos.column}, offset ${state.pos.offset}`
	},
}
