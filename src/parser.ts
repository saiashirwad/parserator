import { debug } from "./debug"
import { Either } from "./either"
import { printErrorContext } from "./errors"
import {
	type ParserContext,
	ParserError,
	type ParserOptions,
	type ParserResult,
	type ParserState,
	State,
} from "./state"
import type { Prettify } from "./types"

export class Parser<T> {
	constructor(
		/**
		 * @internal
		 */
		public run: (state: ParserState) => ParserResult<T>,
		public options?: ParserOptions,
	) {}

	withName(name: string) {
		this.options = { ...this.options, name }
		return this
	}

	static getState() {}

	static succeed<T>(
		value: T,
		state: ParserState,
	): ParserResult<T> {
		return Either.right({ value, state })
	}

	static fail(
		message: string,
		expected: string[] = [],
	): Parser<never> {
		return new Parser<never>((state) => {
			return Parser.error(message, expected, state)
		})
	}

	static error(
		message: string,
		expected: string[],
		state: ParserState,
	): Either<never, ParserError> {
		// TODO: fix this
		// this tends to print out the same error context + message thrice
		return Either.left(
			new ParserError(
				message.includes("Parser Error:")
					? message
					: printErrorContext(state, message),
				expected,
				state,
			),
		)
	}

	/**
	 * Adds an error message to the parser
	 * @param errorCallback - A function that returns an error message
	 * @returns A new parser with the error message added
	 */
	withError(
		errorCallback: (errorCtx: {
			error: ParserError
			state: ParserState
		}) => string,
	) {
		return new Parser<T>((state) => {
			const result = this.run(state)
			if (Either.isLeft(result)) {
				const message = errorCallback({
					error: result.left,
					state: result.left.state,
				})
				return Parser.error(
					message,
					result.left.expected,
					result.left.state,
				)
			}
			return result
		}, this.options)
	}

	parse(
		input: string,
		context: ParserContext = { source: input },
	): ParserResult<T> {
		const state = State.fromInput(input, context)
		const result = this.run(state)
		if (Either.isRight(result)) {
			return result
		}
		if (Either.isLeft(result)) {
			return Parser.error(
				result.left.message,
				result.left.expected,
				result.left.state,
			)
		}
		return result
	}

	withTrace(label: string): Parser<T> {
		return new Parser((state) => {
			if (!state.context?.debug) {
				return this.run(state)
			}
			return debug(this, label).run(state)
		}, this.options)
	}

	parseOrError(
		input: string,
		context: ParserContext = { source: input },
	) {
		const result = this.run(State.fromInput(input, context))
		if (Either.isRight(result)) {
			return result.right.value
		}
		return result.left
	}

	parseOrThrow(
		input: string,
		context: ParserContext = { source: input },
	): T {
		const result = this.parseOrError(input, context)
		if (result instanceof ParserError) {
			throw new Error(result.message)
		}
		return result
	}

	map<B>(f: (a: T) => B): Parser<B> {
		return new Parser<B>((state) => {
			const result = this.run(state)
			if (Either.isLeft(result)) {
				return Parser.error(
					result.left.message,
					result.left.expected,
					result.left.state,
				)
			}
			return Either.match(result, {
				onRight: ({ value, state: newState }) =>
					Either.right({
						value: f(value),
						state: newState,
					}),
				onLeft: Either.left,
			})
		}, this.options)
	}

	flatMap<B>(f: (a: T) => Parser<B>): Parser<B> {
		return new Parser<B>((state) => {
			const result = this.run(state)
			if (Either.isLeft(result)) {
				return Parser.error(
					result.left.message,
					result.left.expected,
					result.left.state,
				)
			}
			return Either.match(result, {
				onRight: ({ value, state: newState }) => {
					const nextParser = f(value)
					return nextParser.run(newState)
				},
				onLeft: Either.left,
			})
		}, this.options)
	}

	static pure = <A>(a: A): Parser<A> => {
		return new Parser((input) =>
			Either.right({ value: a, state: input }),
		)
	}

	static Do = () => {
		return Parser.pure({})
	}

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
			return Either.match(this.run(state), {
				// onRight: ([a, restA]) =>
				onRight: ({ value: a, state: restA }) =>
					Either.match(parserB.run(restA), {
						onRight: ({ value: b, state: restB }) =>
							Either.right({
								value: [a, b],
								state: restB,
							}),
						onLeft: Either.left,
					}),
				onLeft: Either.left,
			})
		})
	}

	then<B>(parserB: Parser<B>): Parser<B> {
		return this.zip(parserB).map(([_, b]) => b)
	}

	thenDiscard<B>(parserB: Parser<B>): Parser<T> {
		return this.zip(parserB).map(([a, _]) => a)
	}

	bind<K extends string, B>(
		k: K,
		other: Parser<B> | ((a: T) => Parser<B>),
	): Parser<
		Prettify<
			T & {
				[k in K]: B
			}
		>
	> {
		return new Parser((state) => {
			const result = this.run(state)
			if (Either.isLeft(result)) {
				return Parser.error(
					result.left.message,
					result.left.expected,
					result.left.state,
				)
			}
			return Either.match(result, {
				onRight: ({ value, state: newState }) => {
					const nextParser =
						other instanceof Parser ? other : other(value)
					return Either.match(nextParser.run(newState), {
						onRight: ({ value: b, state: finalState }) =>
							Either.right({
								value: {
									...(value as object),
									[k]: b,
								} as Prettify<
									T & {
										[k in K]: B
									}
								>,
								state: finalState,
							}),
						onLeft: Either.left,
					})
				},
				onLeft: Either.left,
			})
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
		callback: (
			state: ParserState,
			result: ParserResult<T>,
		) => void,
	): Parser<T> {
		return new Parser((state) => {
			const result = this.run(state)
			callback(state, result)
			return result
		}, this.options)
	}

	static gen<T>(
		f: () => Generator<Parser<any>, T>,
	): Parser<T> {
		return new Parser((state) => {
			const iterator = f()
			let current = iterator.next()
			let currentState: ParserState = state
			while (!current.done) {
				const result = current.value.run(currentState)
				if (Either.isLeft(result)) {
					return result
				}
				currentState = result.right.state
				current = iterator.next(result.right.value)
			}
			return Parser.succeed(current.value, currentState)
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
