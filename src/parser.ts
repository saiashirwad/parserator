import { Either } from "./either"
import {
	State,
	type ParserState,
	type SourcePosition,
} from "./state"
import type { Prettify } from "./utils"

export type ParserContext = {}

type ParserOptions = { name?: string }

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

export class Parser<Result> {
	private errorMessage: string | null = null

	constructor(
		public parse: (
			state: ParserState,
		) => ParserResult<Result>,
		public options?: ParserOptions,
	) {}

	withName(name: string) {
		this.options = { ...this.options, name }
		return this
	}

	static succeed<T>(
		value: T,
		state: ParserState,
	): ParserResult<T> {
		return Either.right([value, state])
	}

	static fail(
		message: string,
		expected: string[] = [],
	): Parser<unknown> {
		return new Parser<unknown>((state) => {
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

	error(message: string): Parser<Result> {
		return new Parser<Result>((state) => {
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
		return new Parser<Result>((state) => {
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

	run(input: string): ParserResult<Result> {
		const result = this.parse(State.fromInput(input))
		if (Either.isRight(result)) {
			return result
		}
		if (this.errorMessage) {
			return Parser.error(
				this.errorMessage,
				result.left.expected,
				result.left.pos,
			)
		}
		return result
	}

	parseOrError(input: string) {
		const result = this.parse(State.fromInput(input))
		if (Either.isRight(result)) {
			return result.right[0]
		}
		return result.left
	}

	parseOrThrow(input: string) {
		const result = this.parse(State.fromInput(input))
		if (Either.isRight(result)) {
			return result.right[0]
		}
		throw result.left
	}

	map<B>(f: (a: Result) => B): Parser<B> {
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

	flatMap<B>(f: (a: Result) => Parser<B>): Parser<B> {
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
	 * Creates a parser that delays construction until parse time.
	 * Useful for recursive parsers.
	 */
	static lazy<T>(fn: () => Parser<T>): Parser<T> {
		return new Parser((state) => {
			const parser = fn()
			return parser.parse(state)
		})
	}

	zip<B>(parserB: Parser<B>): Parser<readonly [Result, B]> {
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

	thenDiscard<B>(parserB: Parser<B>): Parser<Result> {
		return this.zip(parserB).map(([a, _]) => a)
	}

	bind<K extends string, B>(
		k: K,
		other: Parser<B> | ((a: Result) => Parser<B>),
	): Parser<
		Prettify<
			Result & {
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
									Result & {
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

	*[Symbol.iterator](): Generator<
		Parser<Result>,
		Result,
		any
	> {
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
			result: ParserResult<Result>,
		) => void,
	): Parser<Result> {
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
