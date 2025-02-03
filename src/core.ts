import { Either } from "./either"
import { fail, succeed } from "./functions"
import { Parser } from "./parser"
import type { ParserState } from "./types"

export function error<Ctx = {}>(
	message: string,
	expected: string[] = [],
	stateCallback?: (state: ParserState<Ctx>) => ParserState<Ctx>,
): Parser<never, Ctx> {
	return new Parser((state) => {
		return fail(
			{ message, expected },
			stateCallback ? stateCallback(state) : state,
		)
	})
}

export const pure = <A>(a: A): Parser<A> =>
	new Parser((state) => succeed(a, state))

export const Do = pure({})

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
export function lazy<T>(fn: () => Parser<T>): Parser<T> {
	return new Parser((state) => {
		const parser = fn()
		return parser.run(state)
	})
}

/**
 * Creates a parser using generator syntax. This provides a cleaner way to compose parsers
 * using yield* expressions instead of chaining methods.
 *
 * The generator syntax allows writing parsers in a more imperative style, where each
 * yield* expression represents a parsing step. This is often more readable than chaining
 * methods, especially for complex parsers with many steps.
 *
 * The parser will fail if any of the yielded parsers fail. The final value returned from
 * the generator becomes the result of the parser.
 *
 *
 * @param f - A generator function that yields parsers and returns a final value
 * @returns A new parser that runs the yielded parsers in sequence
 * @template T - The type of value produced by the parser
 * @template Ctx - Optional context type shared across parsers
 *
 * @example
 * ```ts
 * const numberParser = parser(function* () {
 *   // Parse optional sign
 *   const sign = yield* optional(char('-'))
 *
 *   // Parse digits
 *   const digits = yield* many1(digit)
 *
 *   // Convert to number
 *   return parseInt((sign ?? '') + digits.join(''))
 * })
 *
 * numberParser.run('-123') // Right([123, {...}])
 * ```
 *
 */
export function parser<T, Ctx = unknown>(
	f: () => Generator<Parser<any, Ctx>, T, any>,
): Parser<T, Ctx> {
	return new Parser<T, Ctx>((state) => {
		const iterator = f()
		let current = iterator.next()
		let currentState: ParserState<Ctx> = state
		while (!current.done) {
			const { result, state: updatedState } = current.value.run(currentState)
			if (Either.isLeft(result)) {
				return fail(result.left, updatedState)
			}
			currentState = updatedState
			current = iterator.next(result.right)
		}
		return succeed(current.value, currentState)
	})
}
