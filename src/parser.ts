import { Either } from "./either"
import { debug } from "./debug"
import {
	State,
	type ParserState,
	type SourcePosition,
} from "./state"
import type { Prettify } from "./types"

export type ParserContext = {
	debug?: boolean
}

export type ParserOptions = { name?: string }

export class ParserError {
	constructor(
		public message: string,
		public expected: string[],
		public pos: SourcePosition,
	) {}
}

export type ParserResult<T> = Either<
	[T, ParserState],
	ParserError
>

export class Parser<r> {
	private errorMessage: string | null = null

	constructor(
		public parse: (state: ParserState) => ParserResult<r>,
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
		return Either.right([value, state])
	}

	static fail(
		message: string,
		expected: string[] = [],
	): Parser<never> {
		return new Parser<never>((state) => {
			return Parser.error(message, expected, state.pos)
		})
	}

	static error(
		message: string,
		expected: string[],
		pos: SourcePosition,
	) {
		return Either.left(
			new ParserError(message, expected, pos),
		)
	}

	error(message: string): Parser<r> {
		return new Parser<r>((state) => {
			const result = this.parse(state)
			if (Either.isLeft(result)) {
				return Parser.error(
					message,
					result.left.expected,
					result.left.pos,
				)
			}
			return result
		}, this.options)
	}

	errorCallback(
		onError: (
			error: ParserError,
			state: ParserState,
		) => string,
	) {
		return new Parser<r>((state) => {
			const result = this.parse(state)
			if (Either.isLeft(result)) {
				return Parser.error(
					onError(result.left, state),
					result.left.expected,
					result.left.pos,
				)
			}
			return result
		}, this.options)
	}

	run(
		input: string,
		context: ParserContext = {},
	): ParserResult<r> {
		const result = this.parse(
			State.fromInput(input, context),
		)
		if (Either.isRight(result)) {
			return result
		}
		if (Either.isLeft(result)) {
			if (this.errorMessage) {
				return Parser.error(
					this.errorMessage,
					result.left.expected,
					result.left.pos,
				)
			}
		}
		return result
	}

	withTrace(label: string): Parser<r> {
		return new Parser((state) => {
			if (!state.context?.debug) {
				return this.parse(state)
			}
			return debug(this, label).parse(state)
		}, this.options)
	}

	parseOrError(input: string, context: ParserContext = {}) {
		const result = this.parse(
			State.fromInput(input, context),
		)
		if (Either.isRight(result)) {
			return result.right[0]
		}
		return result.left
	}

	parseOrThrow(
		input: string,
		context: ParserContext = {},
	): r {
		const result = this.parseOrError(input, context)
		if (result instanceof ParserError) {
			throw new Error(result.message)
		}
		return result
	}

	map<B>(f: (a: r) => B): Parser<B> {
		return new Parser<B>((state) => {
			const result = this.parse(state)
			if (Either.isLeft(result) && this.errorMessage) {
				return Parser.error(
					this.errorMessage,
					result.left.expected,
					result.left.pos,
				)
			}
			return Either.match(result, {
				onRight: ([value, newState]) =>
					Either.right([f(value), newState] as const),
				onLeft: Either.left,
			})
		}, this.options)
	}

	flatMap<B>(f: (a: r) => Parser<B>): Parser<B> {
		return new Parser<B>((state) => {
			const result = this.parse(state)
			if (Either.isLeft(result) && this.errorMessage) {
				return Parser.error(
					this.errorMessage,
					result.left.expected,
					result.left.pos,
				)
			}
			return Either.match(result, {
				onRight: ([value, newState]) => {
					const nextParser = f(value)
					return nextParser.parse(newState)
				},
				onLeft: Either.left,
			})
		}, this.options)
	}

	static pure = <A>(a: A): Parser<A> => {
		return new Parser((input) => Either.right([a, input]))
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
			return parser.parse(state)
		})
	}

	zip<B>(parserB: Parser<B>): Parser<readonly [r, B]> {
		return new Parser((state) => {
			return Either.match(this.parse(state), {
				onRight: ([a, restA]) =>
					Either.match(parserB.parse(restA), {
						onRight: ([b, restB]) =>
							Either.right([[a, b] as const, restB]),
						onLeft: Either.left,
					}),
				onLeft: Either.left,
			})
		})
	}

	then<B>(parserB: Parser<B>): Parser<B> {
		return this.zip(parserB).map(([_, b]) => b)
	}

	thenDiscard<B>(parserB: Parser<B>): Parser<r> {
		return this.zip(parserB).map(([a, _]) => a)
	}

	bind<K extends string, B>(
		k: K,
		other: Parser<B> | ((a: r) => Parser<B>),
	): Parser<
		Prettify<
			r & {
				[k in K]: B
			}
		>
	> {
		return new Parser((state) => {
			const result = this.parse(state)
			if (Either.isLeft(result) && this.errorMessage) {
				return Parser.error(
					this.errorMessage,
					result.left.expected,
					result.left.pos,
				)
			}
			return Either.match(result, {
				onRight: ([value, newState]) => {
					const nextParser =
						other instanceof Parser ? other : other(value)
					return Either.match(nextParser.parse(newState), {
						onRight: ([b, finalState]) =>
							Either.right([
								{
									...(value as object),
									[k]: b,
								} as Prettify<
									r & {
										[k in K]: B
									}
								>,
								finalState,
							] as const),
						onLeft: Either.left,
					})
				},
				onLeft: Either.left,
			})
		}, this.options)
	}

	*[Symbol.iterator](): Generator<Parser<r>, r, any> {
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
			result: ParserResult<r>,
		) => void,
	): Parser<r> {
		return new Parser((state) => {
			const result = this.parse(state)
			callback(state, result)
			return result
		}, this.options)
	}

	static gen<Yielded, Returned>(
		f: ($: {
			<A>(_: Parser<A>): Parser<A>
		}) => Generator<Yielded, Returned, any>,
	): Parser<Returned> {
		const iterator = f((_: any) => new Parser(_))
		function run(
			state:
				| IteratorYieldResult<Yielded>
				| IteratorReturnResult<Returned>,
		): Parser<Returned> {
			if (state.done) {
				if (state.value instanceof Parser) {
					return state.value as Parser<Returned>
				}
				return Parser.pure(state.value as Returned)
			}
			const value = state.value
			if (value instanceof Parser) {
				return value.flatMap((result) =>
					run(iterator.next(result)),
				)
			}
			throw new Error("Expected a Parser")
		}

		return run(iterator.next())
	}
}
