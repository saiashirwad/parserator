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
