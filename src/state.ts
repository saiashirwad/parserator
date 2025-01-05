import type { Either } from "./either"
import type { Prettify } from "./types"

export type ParserContext<C> = Prettify<
	C & {
		debug?: boolean
		source: string
	}
>

export type ParserOptions = { name?: string }

export class ParserError {
	constructor(
		public message: string,
		public expected: string[],
	) {}
}

export type ParserOutput<T, C = {}> = {
	state: ParserState<C>
	result: Either<T, ParserError>
}

export type SourcePosition = {
	line: number
	column: number
	offset: number
}

export type ParserState<C = {}> = {
	remaining: string
	pos: SourcePosition
	context: ParserContext<C>
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
	fromInput<C = {}>(input: string, context: ParserContext<C>): ParserState<C> {
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
	consume<C = {}>(state: ParserState<C>, n: number): ParserState<C> {
		if (n === 0) return state
		if (n > state.remaining.length) {
			throw new Error("Cannot consume more characters than remaining")
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
	consumeString<C = {}>(state: ParserState<C>, str: string): ParserState<C> {
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
	consumeWhile<C = {}>(
		state: ParserState<C>,
		predicate: (char: string) => boolean,
	): ParserState<C> {
		let i = 0
		while (i < state.remaining.length && predicate(state.remaining[i])) {
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
	peek<C = {}>(state: ParserState<C>, n: number = 1): string {
		return state.remaining.slice(0, n)
	},

	/**
	 * Checks if the parser has reached the end of input.
	 *
	 * @param state - The current parser state
	 * @returns True if at end of input, false otherwise
	 */
	isAtEnd<C = {}>(state: ParserState<C>): boolean {
		return state.remaining.length === 0
	},

	printPosition<C = {}>(state: ParserState<C>): string {
		return `line ${state.pos.line}, column ${state.pos.column}, offset ${state.pos.offset}`
	},
}
