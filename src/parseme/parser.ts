import { Either } from "./either"
import type { Prettify } from "./utils"

export type SourcePosition = {
	line: number
	column: number
	offset: number
}

export type ParserState = {
	remaining: string
	pos: SourcePosition
}

export type ParserContext = {}

type ParserOptions = { name?: string }

export class ParserError {
	constructor(
		public message: string,
		public expected: string[],
		public pos: SourcePosition,
	) {}
}

export type ParserResult<T> = Either<[T, ParserState], ParserError>

export class Parser<Result> {
	private errorMessage: string | null = null

	constructor(
		public _run: (state: ParserState) => ParserResult<Result>,
		public options?: ParserOptions,
	) {}

	static succeed<T>(
		value: T,
		state: ParserState,
		consumed?: string,
	): ParserResult<T> {
		return Either.right([value, consumeString(state, consumed)])
	}

	static fail(message: string, expected: string[] = []): Parser<unknown> {
		return new Parser<unknown>((state) => {
			return Parser.error(message, expected, state.pos)
		})
	}

	static error(message: string, expected: string[], pos: SourcePosition) {
		return Either.left(new ParserError(message, expected, pos))
	}

	error(message: string): Parser<Result> {
		return new Parser<Result>((state) => {
			const result = this._run(state)
			if (Either.isLeft(result)) {
				return Parser.error(message, result.left.expected, result.left.pos)
			}
			return result
		}, this.options)
	}

	error2(onError: (error: ParserError) => string) {
		return new Parser<Result>((state) => {
			const result = this._run(state)
			if (Either.isLeft(result)) {
				return Parser.error(
					onError(result.left),
					result.left.expected,
					result.left.pos,
				)
			}
			return result
		}, this.options)
	}

	run(input: string): ParserResult<Result> {
		const result = this._run(initialState(input))
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

	map<B>(f: (a: Result) => B): Parser<B> {
		return new Parser<B>((state) => {
			const result = this._run(state)
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
			const result = this._run(state)
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
					return nextParser._run(newState)
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

	zip<B>(parserB: Parser<B>): Parser<readonly [Result, B]> {
		return new Parser((state) =>
			Either.match(this._run(state), {
				onRight: ([a, restA]) =>
					Either.match(parserB._run(restA), {
						onRight: ([b, restB]) => Either.right([[a, b] as const, restB]),
						onLeft: Either.left,
					}),
				onLeft: Either.left,
			}),
		)
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
			const result = this._run(state)
			if (Either.isLeft(result) && this.errorMessage) {
				return Parser.error(
					this.errorMessage,
					result.left.expected,
					result.left.pos,
				)
			}
			return Either.match(result, {
				onRight: ([value, newState]) => {
					const nextParser = other instanceof Parser ? other : other(value)
					return Either.match(nextParser._run(newState), {
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

	*[Symbol.iterator](): Generator<Parser<Result>, Result, any> {
		return yield this
	}

	static gen<Yielded, Returned>(
		f: ($: {
			<A>(_: Parser<A>): Parser<A>
		}) => Generator<Yielded, Returned, any>,
	): Parser<Returned> {
		const iterator = f((_: any) => new Parser(_))
		function run(
			state: IteratorYieldResult<Yielded> | IteratorReturnResult<Returned>,
		): Parser<Returned> {
			if (state.done) {
				if (state.value instanceof Parser) {
					return state.value as Parser<Returned>
				}
				return Parser.pure(state.value as Returned)
			}
			const value = state.value
			if (value instanceof Parser) {
				return value.flatMap((result) => run(iterator.next(result)))
			}
			throw new Error("Expected a Parser")
		}

		return run(iterator.next())
	}
}

export function initialState(input: string): ParserState {
	return {
		remaining: input,
		pos: {
			line: 1,
			column: 1,
			offset: 0,
		},
	}
}

export function updatePosition(
	pos: SourcePosition,
	consumed: string,
): SourcePosition {
	let { line, column, offset } = pos
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
		line,
		column,
		offset,
	}
}

export function updateState(
	oldState: ParserState,
	newState: ParserState,
): ParserState {
	const consumed = oldState.remaining.slice(
		0,
		oldState.remaining.length - newState.remaining.length,
	)
	return {
		...oldState,
		remaining: oldState.remaining.slice(consumed.length),
		pos: updatePosition(oldState.pos, consumed),
	}
}

export function consumeString(
	state: ParserState,
	consumed?: string,
): ParserState {
	const newPos = updatePosition(state.pos, consumed ?? "")

	return {
		remaining: state.remaining.slice(consumed?.length ?? 0),
		pos: newPos,
	}
}
