import { Either } from "./either"
import { succeed, fail } from "./functions"
import { ParserError } from "./errors"
import { State } from "./state"
import type {
	Prettify,
	ParserContext,
	ParserOptions,
	ParserState,
	ParserOutput,
} from "./types"

type BindResult<T, K extends string, B> = Prettify<
	T & {
		[k in K]: B
	}
>

export class Parser<T, Ctx = {}> {
	constructor(
		/**
		 * @internal
		 */
		public run: (state: ParserState<Ctx>) => ParserOutput<T, Ctx>,
		public options?: ParserOptions,
	) {}

	name(name: string) {
		this.options = { ...this.options, name }
		return this
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
				return fail(
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
			return fail(result.left, state)
		}
		return succeed(result.right, state)
	}

	//withTrace(label: string): Parser<T, Ctx> {
	//	return new Parser<T, Ctx>((state) => {
	//		if (!state.context?.debug) {
	//			return this.run(state)
	//		}
	//		return debug(this, label).run(state)
	//	}, this.options)
	//}

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
				return fail(result.left, state)
			}
			return succeed(f(result.right), newState)
		})
	}

	flatMap<B>(f: (a: T) => Parser<B, Ctx>): Parser<B, Ctx> {
		return new Parser<B, Ctx>((state) => {
			const { result, state: newState } = this.run(state)
			if (Either.isLeft(result)) {
				return fail(result.left, newState)
			}
			const nextParser = f(result.right)
			return nextParser.run(newState)
		})
	}

	zip<B>(parserB: Parser<B, Ctx>): Parser<[T, B], Ctx> {
		return new Parser((state) => {
			const { result: a, state: stateA } = this.run(state)
			if (Either.isLeft(a)) {
				return fail(a.left, stateA)
			}
			const { result: b, state: stateB } = parserB.run(stateA)
			if (Either.isLeft(b)) {
				return fail(b.left, stateB)
			}
			return succeed([a.right, b.right], stateB)
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
				return fail(resultA.left, stateA)
			}
			const nextParser = other instanceof Parser ? other : other(resultA.right)
			const { result: resultB, state: stateB } = nextParser.run(stateA)
			if (Either.isLeft(resultB)) {
				return fail(resultB.left, stateB)
			}
			return succeed(
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
