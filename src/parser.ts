import { debug } from "./debug"
import { Either } from "./either"
import { printErrorContext } from "./errors"
import {
	type ParserContext,
	ParserError,
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

export function createContext<Ctx>(
	context: Omit<ParserContext<Ctx>, "source">,
): ParserContext<Ctx> {
	// @ts-expect-error this is fine
	return {
		...context,
		source: "",
	}
}

export class Parser<T, Ctx = {}> {
	constructor(
		/**
		 * @internal
		 */
		public run: (state: ParserState<Ctx>) => ParserOutput<T, Ctx>,
		public options?: ParserOptions,
	) {}

	withName(name: string) {
		this.options = { ...this.options, name }
		return this
	}

	static succeed<T, Ctx = {}>(
		value: T,
		state: ParserState<Ctx>,
	): ParserOutput<T, Ctx> {
		return {
			state,
			result: Either.right(value),
		}
	}

	static fail<Ctx = {}>(
		error: {
			message: string
			expected?: string[]
		},
		state: ParserState<Ctx>,
	): ParserOutput<never, Ctx> {
		const errorMessage = error.message.includes("Parser Error:")
			? error.message
			: printErrorContext(state, error.message)

		return {
			state,
			result: Either.left(new ParserError(errorMessage, error.expected ?? [])),
		}
	}

	static error<Ctx = {}>(
		message: string,
		expected: string[] = [],
	): Parser<never, Ctx> {
		return new Parser((state) => {
			return Parser.fail({ message, expected }, state)
		})
	}

	/**
	 * Adds an error message to the parser
	 * @param makeMessage - A function that returns an error message
	 * @returns A new parser with the error message added
	 */
	withError(
		makeMessage: (errorCtx: {
			error: ParserError
			state: ParserState<Ctx>
		}) => string,
	): Parser<T, Ctx> {
		return new Parser<T, Ctx>((state) => {
			const output = this.run(state)
			if (Either.isLeft(output.result)) {
				return Parser.fail(
					{
						message: makeMessage({
							error: output.result.left,
							state: output.state,
						}),
						expected: output.result.left.expected,
					},
					output.state,
				)
			}
			return output
		}, this.options)
	}

	parse(
		input: string,
		context = { source: input } as ParserContext<Ctx>,
	): ParserOutput<T, Ctx> {
		const { result, state } = this.run(State.fromInput(input, context))
		if (Either.isLeft(result)) {
			return Parser.fail(result.left, state)
		}
		return Parser.succeed(result.right, state)
	}

	withTrace(label: string): Parser<T, Ctx> {
		return new Parser<T, Ctx>((state) => {
			if (!state.context?.debug) {
				return this.run(state)
			}
			return debug(this, label).run(state)
		}, this.options)
	}

	parseOrError(
		input: string,
		context = { source: input } as ParserContext<Ctx>,
	) {
		const { result } = this.run(State.fromInput(input, context))
		if (Either.isRight(result)) {
			return result.right
		}
		return result.left
	}

	parseOrThrow(
		input: string,
		context = { source: input } as ParserContext<Ctx>,
	): T {
		const { result } = this.parse(
			input,
			context ?? {
				source: input,
			},
		)
		if (Either.isLeft(result)) {
			throw new Error(result.left.message)
		}
		return result.right
	}

	map<B>(f: (a: T) => B): Parser<B, Ctx> {
		return new Parser<B, Ctx>((state) => {
			const { result, state: newState } = this.run(state)
			if (Either.isLeft(result)) {
				return Parser.fail(result.left, state)
			}
			return Parser.succeed(f(result.right), newState)
		})
	}

	flatMap<B>(f: (a: T) => Parser<B, Ctx>): Parser<B, Ctx> {
		return new Parser<B, Ctx>((state) => {
			const { result, state: newState } = this.run(state)
			if (Either.isLeft(result)) {
				return Parser.fail(result.left, newState)
			}
			const nextParser = f(result.right)
			return nextParser.run(newState)
		})
	}

	static pure = <A>(a: A): Parser<A> =>
		new Parser((state) => Parser.succeed(a, state))

	static Do = Parser.pure({})

	/**
	 * Gets the current parser context.
	 * @returns A parser that succeeds with the current context
	 */
	static getContext<Ctx>(
		context: ParserContext<Ctx>,
	): Parser<ParserContext<Ctx>, Ctx> {
		return new Parser((state) => Parser.succeed(context, state))
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

	zip<B>(parserB: Parser<B, Ctx>): Parser<[T, B], Ctx> {
		return new Parser((state) => {
			const { result: a, state: stateA } = this.run(state)
			if (Either.isLeft(a)) {
				return Parser.fail(a.left, stateA)
			}
			const { result: b, state: stateB } = parserB.run(stateA)
			if (Either.isLeft(b)) {
				return Parser.fail(b.left, stateB)
			}
			return Parser.succeed([a.right, b.right], stateB)
		})
	}

	then<B>(parserB: Parser<B, Ctx>): Parser<B, Ctx> {
		return this.zip(parserB).map(([_, b]) => b)
	}

	zipRight = this.then

	thenDiscard<B>(parserB: Parser<B, Ctx>): Parser<T, Ctx> {
		return this.zip(parserB).map(([a, _]) => a)
	}

	zipLeft = this.thenDiscard

	bind<K extends string, B>(
		k: K,
		other: Parser<B, Ctx> | ((a: T) => Parser<B, Ctx>),
	): Parser<BindResult<T, K, B>, Ctx> {
		return new Parser<BindResult<T, K, B>, Ctx>((state) => {
			const { result: resultA, state: stateA } = this.run(state)
			if (Either.isLeft(resultA)) {
				return Parser.fail(resultA.left, stateA)
			}
			const nextParser = other instanceof Parser ? other : other(resultA.right)
			const { result: resultB, state: stateB } = nextParser.run(stateA)
			if (Either.isLeft(resultB)) {
				return Parser.fail(resultB.left, stateB)
			}
			return Parser.succeed(
				{ ...resultA.right, [k]: resultB.right } as BindResult<T, K, B>,
				stateB,
			)
		}, this.options)
	}

	*[Symbol.iterator](): Generator<Parser<T, Ctx>, T, any> {
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
			state: ParserState<Ctx>
			result: ParserOutput<T, Ctx>
		}) => void,
	): Parser<T, Ctx> {
		return new Parser((state) => {
			const result = this.run(state)
			callback({ state, result })
			return result
		}, this.options)
	}

	static gen<T, Ctx = {}>(
		f: () => Generator<Parser<any, Ctx>, T>,
	): Parser<T, Ctx> {
		return new Parser<T, Ctx>((state) => {
			const iterator = f()
			let current = iterator.next()
			let currentState: ParserState<Ctx> = state
			while (!current.done) {
				const { result, state: updatedState } = current.value.run(currentState)
				if (Either.isLeft(result)) {
					return Parser.fail(result.left, updatedState)
				}
				currentState = updatedState
				current = iterator.next(result.right)
			}
			return Parser.succeed(current.value, currentState)
		})
	}

	trim(parser: Parser<any, Ctx>) {
		return parser.then(this).thenDiscard(parser)
	}

	trimLeft(parser: Parser<any, Ctx>): Parser<T, Ctx> {
		return parser.then(this)
	}

	trimRight(parser: Parser<any, Ctx>): Parser<T, Ctx> {
		return this.thenDiscard(parser)
	}
}
