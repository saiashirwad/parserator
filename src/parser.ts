import { debug } from "./debug"
import { Either } from "./either"
import { printErrorContext } from "./errors"
import {
	type ParserContext,
	type ParserError,
	type ParserOptions,
	type ParserOutput,
	type ParserState,
	State,
} from "./state"
import type { Prettify } from "./types"

type BindResult<T, K extends string, B> = Prettify<
	T & {
		[k in K]: B
	}
>

export class Parser<T> {
	constructor(
		/**
		 * @internal
		 */
		public run: (state: ParserState) => ParserOutput<T>,
		public options?: ParserOptions,
	) {}

	withName(name: string) {
		this.options = { ...this.options, name }
		return this
	}

	static getState() {}

	static succeed<T>(value: T, state: ParserState): ParserOutput<T> {
		return {
			state,
			result: Either.right(value),
		}
	}

	static fail(message: string, expected: string[] = []): Parser<never> {
		return new Parser<never>((state) => {
			return {
				state,
				result: Either.left({
					message,
					expected,
				}),
			}
		})
	}

	static error(
		message: string,
		expected: string[],
		state: ParserState,
	): Either<never, ParserError> {
		const errorMessage = message.includes("Parser Error:")
			? message
			: printErrorContext(state, message)
		return Either.left({
			message: errorMessage,
			expected,
		})
	}

	static resultError(error: ParserError): Either<never, ParserError> {
		return Either.left(error)
	}

	/**
	 * Adds an error message to the parser
	 * @param makeMessage - A function that returns an error message
	 * @returns A new parser with the error message added
	 */
	withError(
		makeMessage: (errorCtx: {
			error: ParserError
			state: ParserState
		}) => string,
	): Parser<T> {
		return new Parser<T>((state) => {
			const output = this.run(state)
			if (Either.isLeft(output.result)) {
				return {
					state: output.state,
					result: Either.left({
						message: makeMessage({
							error: output.result.left,
							state: output.state,
						}),
						expected: output.result.left.expected,
					}),
				}
			}
			return output
		}, this.options)
	}

	parse(
		input: string,
		context: ParserContext = { source: input },
	): ParserOutput<T> {
		const { result, state } = this.run(State.fromInput(input, context))
		if (Either.isLeft(result)) {
			return {
				state,
				result: Either.left(result.left),
			}
		}
		return {
			state,
			result: Either.right(result.right),
		}
	}

	withTrace(label: string): Parser<T> {
		return new Parser((state) => {
			if (!state.context?.debug) {
				return this.run(state)
			}
			return debug(this, label).run(state)
		}, this.options)
	}

	parseOrError(input: string, context: ParserContext = { source: input }) {
		const { result } = this.run(State.fromInput(input, context))
		if (Either.isRight(result)) {
			return result.right
		}
		return result.left
	}

	parseOrThrow(input: string, context: ParserContext = { source: input }): T {
		const { result } = this.parse(input, context)
		if (Either.isLeft(result)) {
			throw new Error(result.left.message)
		}
		return result.right
	}

	map<B>(f: (a: T) => B): Parser<B> {
		return new Parser<B>((state) => {
			const { result, state: newState } = this.run(state)
			if (Either.isLeft(result)) {
				return { state, result: Either.left(result.left) }
			}
			return {
				state: newState,
				result: Either.right(f(result.right)),
			}
		})
	}

	flatMap<B>(f: (a: T) => Parser<B>): Parser<B> {
		return new Parser<B>((state) => {
			const { result, state: newState } = this.run(state)
			if (Either.isLeft(result)) {
				return {
					state: newState,
					result: Either.left(result.left),
				}
			}
			const nextParser = f(result.right)
			return nextParser.run(newState)
		})
	}

	static pure = <A>(a: A): Parser<A> =>
		new Parser((state) => ({
			state,
			result: Either.right(a),
		}))

	static Do = Parser.pure({})

	/**
	 * Creates a new parser that lazily evaluates the given function.
	 * This is useful for creating recursive parsers.
	 *
	 * @param fn - A function that returns a parser
	 * @returns A new parser that evaluates the function when parsing
	 * @template T The type of value produced by the parser
	 *
	 * @example
	 * ```ts
	 * // Create a recursive parser for nested parentheses
	 * const parens: Parser<string> = Parser.lazy(() =>
	 *   between(
	 *     char('('),
	 *     char(')'),
	 *     parens
	 *   )
	 * )
	 * ```
	 */
	static lazy<T>(fn: () => Parser<T>): Parser<T> {
		return new Parser((state) => {
			const parser = fn()
			return parser.run(state)
		})
	}

	zip<B>(parserB: Parser<B>): Parser<[T, B]> {
		return new Parser((state) => {
			const { result: a, state: stateA } = this.run(state)
			if (Either.isLeft(a)) {
				return {
					state: stateA,
					result: Either.left(a.left),
				}
			}
			const { result: b, state: stateB } = parserB.run(stateA)
			if (Either.isLeft(b)) {
				return {
					state: stateB,
					result: Either.left(b.left),
				}
			}
			return {
				state: stateB,
				result: Either.right([a.right, b.right]),
			}
		})
	}

	then<B>(parserB: Parser<B>): Parser<B> {
		return this.zip(parserB).map(([_, b]) => b)
	}

	zipRight = this.then

	thenDiscard<B>(parserB: Parser<B>): Parser<T> {
		return this.zip(parserB).map(([a, _]) => a)
	}

	zipLeft = this.thenDiscard

	bind<K extends string, B>(
		k: K,
		other: Parser<B> | ((a: T) => Parser<B>),
	): Parser<BindResult<T, K, B>> {
		return new Parser((state) => {
			const { result: resultA, state: stateA } = this.run(state)
			if (Either.isLeft(resultA)) {
				return { state: stateA, result: Either.left(resultA.left) }
			}
			const nextParser = other instanceof Parser ? other : other(resultA.right)
			const { result: resultB, state: stateB } = nextParser.run(stateA)
			if (Either.isLeft(resultB)) {
				return { state: stateB, result: Either.left(resultB.left) }
			}
			return {
				state: stateB,
				result: Either.right({
					...resultA.right,
					[k]: resultB.right,
				} as BindResult<T, K, B>),
			}
		}, this.options)
	}

	*[Symbol.iterator](): Generator<Parser<T>, T, any> {
		return yield this
	}

	/**
	 * Adds a tap point to observe the current state and result during parsing.
	 * Useful for debugging parser behavior.
	 *
	 * @param callback - Function called with current state and result
	 * @returns The same parser with the tap point added
	 */
	tap(
		callback: (args: {
			state: ParserState
			result: ParserOutput<T>
		}) => void,
	): Parser<T> {
		return new Parser((state) => {
			const result = this.run(state)
			callback({ state, result })
			return result
		}, this.options)
	}

	static gen<T>(f: () => Generator<Parser<any>, T>): Parser<T> {
		return new Parser((state) => {
			const iterator = f()
			let current = iterator.next()
			let currentState: ParserState = state
			while (!current.done) {
				const { result, state: newState } = current.value.run(currentState)
				if (Either.isLeft(result)) {
					return { result, state: newState }
				}
				currentState = newState
				current = iterator.next(result.right)
			}
			return {
				result: Either.right(current.value),
				state: currentState,
			}
		})
	}

	trim(parser: Parser<any>) {
		return parser.then(this).thenDiscard(parser)
	}

	trimLeft(parser: Parser<any>): Parser<T> {
		return parser.then(this)
	}

	trimRight(parser: Parser<any>): Parser<T> {
		return this.thenDiscard(parser)
	}
}
