import { Either } from "./either"
import { Parser } from "./parser"
import { State } from "./state"

/**
 * Creates a parser that looks ahead in the input stream without consuming any input.
 * The parser will succeed with the result of the given parser but won't advance the input position.
 *
 * @param parser - The parser to look ahead with
 * @returns A new parser that peeks at the input without consuming it
 * ```ts
 * const parser = lookAhead(char('a'))
 * parser.run('abc') // Right(['a', {...}])
 * // Input position remains at 'abc', 'a' is not consumed
 * ```
 */
export function lookAhead<T>(parser: Parser<T>) {
	return new Parser((state) => {
		const result = parser.parse(state)
		if (Either.isRight(result)) {
			return Parser.succeed(result.right[0], state)
		}
		return Parser.succeed(undefined, state)
	})
}

/**
 * Creates a parser that succeeds only if the given parser fails to match.
 * If the parser succeeds, this parser fails with an error message.
 *
 * @param parser - The parser that should not match
 * @returns A new parser that succeeds only if the input parser fails
 * ```ts
 * const notA = notFollowedBy(char('a'))
 * notA.run('bcd') // Right([true, {...}]) - Succeeds because 'a' is not found
 * notA.run('abc') // Left(error) - Fails because 'a' is found
 * ```
 */
export function notFollowedBy<T>(parser: Parser<T>) {
	return new Parser((state) => {
		const result = parser.parse(state)
		if (Either.isRight(result)) {
			if (parser.options?.name) {
				return Parser.error(
					`Found ${parser.options.name} when it should not appear here`,
					[],
					state.pos,
				)
			}
			return Parser.error(
				"Expected not to follow",
				[],
				state.pos,
			)
		}
		return Parser.succeed(true, state)
	})
}

/**
 * Creates a parser that matches an exact string in the input.
 *
 * @param str - The string to match
 * @returns A parser that matches and consumes the exact string
 * ```ts
 * const parser = string("hello")
 * parser.run("hello world") // Right(["hello", {...}])
 * parser.run("goodbye") // Left(error)
 * ```
 */
export const string = (str: string): Parser<string> => {
	return new Parser(
		(state) => {
			if (state.remaining.startsWith(str)) {
				return Parser.succeed(
					str,
					State.consumeString(state, str),
				)
			}

			const errorMessage =
				`Expected ${str}, ` +
				`but found ${state.remaining.slice(0, 10)}...`

			return Parser.error(errorMessage, [str], state.pos)
		},
		{ name: str },
	)
}

/**
 * Creates a parser that matches an exact string literal type.
 * Similar to string parser but preserves the literal type information.
 *
 * @param str - The string literal to match
 * @returns A parser that matches and consumes the exact string with preserved type
 * ```ts
 * const parser = constString("hello") // Parser<"hello">
 * parser.run("hello world") // Right(["hello", {...}])
 * parser.run("goodbye") // Left(error)
 * ```
 */
export function constString<const T extends string>(
	str: T,
): Parser<T> {
	return string(str) as any
}

/**
 * Creates a parser that matches a single character.
 *
 * @param ch - The character to match
 * @returns A parser that matches and consumes a single character
 * ```ts
 * const parser = char("a")
 * parser.run("abc") // Right(["a", {...}])
 * parser.run("xyz") // Left(error)
 * ```
 */
export const char = <T extends string>(
	ch: T,
): Parser<T> => {
	return new Parser(
		(state) => {
			if (ch.length !== 1) {
				return Parser.error(
					"Incorrect usage of char parser.",
					[ch],
					state.pos,
				)
			}
			if (state.remaining[0] === ch) {
				return Parser.succeed(ch, State.consume(state, 1))
			}

			const errorMessage = `Expected ${ch} but found ${state.remaining.at(0)}.`

			return Parser.error(errorMessage, [ch], state.pos)
		},
		{ name: ch },
	)
}

/**
 * A parser that matches any single alphabetic character (a-z, A-Z).
 *
 * ```ts
 * const parser = alphabet
 * parser.run("abc") // Right(["a", {...}])
 * parser.run("123") // Left(error)
 * ```
 */
export const alphabet = new Parser(
	(state) => {
		if (State.isAtEnd(state)) {
			return Parser.error(
				"Unexpected end of input",
				[],
				state.pos,
			)
		}
		const first = state.remaining[0]
		if (first && /^[a-zA-Z]$/.test(first)) {
			return Parser.succeed(first, State.consume(state, 1))
		}
		return Parser.error(
			`Expected alphabetic character, but got '${first}'`,
			[],
			state.pos,
		)
	},
	{ name: "alphabet" },
)

/**
 * A parser that matches any single digit character (0-9).
 *
 * ```ts
 * const parser = digit
 * parser.run("123") // Right(["1", {...}])
 * parser.run("abc") // Left(error)
 * ```
 */
export const digit = new Parser(
	(state) => {
		if (State.isAtEnd(state)) {
			return Parser.error(
				"Unexpected end of input",
				[],
				state.pos,
			)
		}
		const first = state.remaining[0]
		if (first && /^[0-9]$/.test(first)) {
			return Parser.succeed(first, State.consume(state, 1))
		}
		return Parser.error(
			`Expected digit, but got '${first}'`,
			[],
			state.pos,
		)
	},
	{ name: "digit" },
)

/**
 * Creates a parser that matches zero or more occurrences of elements separated by a separator.
 *
 * @param sepParser - Parser for the separator between elements
 * @param parser - Parser for the elements
 * @returns A parser that produces an array of matched elements
 *
 * ```ts
 * const parser = sepBy(char(','), digit)
 * parser.run("1,2,3") // Right([["1", "2", "3"], {...}])
 * parser.run("") // Right([[], {...}])
 * ```
 */
export function sepBy<S, T>(
	sepParser: Parser<S>,
	parser: Parser<T>,
): Parser<T[]> {
	return Parser.gen(function* () {
		const acc: Array<T> = []
		const firstResult = yield* optional(parser)
		if (firstResult) {
			acc.push(firstResult)
			while (true) {
				const sepResult = yield* optional(sepParser)
				if (!sepResult) {
					return acc
				}
				const result = yield* parser
				acc.push(result)
			}
		}
		return acc
	}) as Parser<T[]>
}

/**
 * Creates a parser that matches content between two string delimiters.
 *
 * @param start - The opening delimiter string
 * @param end - The closing delimiter string
 * @param parser - The parser for the content between delimiters
 * @returns A parser that matches content between delimiters
 *
 * ```ts
 * const parser = between('(', ')', digit)
 * parser.run('(5)') // Right(['5', {...}])
 * parser.run('5') // Left(error)
 * ```
 */
export function between<T>(
	start: Parser<any>,
	end: Parser<any>,
	parser: Parser<T>,
): Parser<T> {
	return Parser.gen(function* () {
		yield* start
		const result = yield* parser
		yield* end
		return result
	})
}

/**
 * Internal helper function for creating repetition parsers.
 *
 * @param count - Minimum number of repetitions required
 * @returns A function that creates a parser matching multiple occurrences
 */
function many_<S, T>(count: number) {
	return (
		parser: Parser<T>,
		separator?: Parser<S>,
	): Parser<T[]> => {
		return new Parser((state) => {
			const results: T[] = []
			let currentState = state

			while (true) {
				// Try to parse the next item
				const itemResult = parser.parse(currentState)
				if (Either.isLeft(itemResult)) {
					break
				}

				// Add the item and update state
				const [value, newState] = itemResult.right
				results.push(value)
				currentState = newState

				// If we have a separator, try to parse it
				if (separator) {
					const sepResult = separator.parse(currentState)
					if (Either.isLeft(sepResult)) {
						break
					}
					currentState = sepResult.right[1]
				}
			}

			if (results.length >= count) {
				return Parser.succeed(results, currentState)
			}

			return Parser.error(
				`Expected at least ${count} occurrences, but only found ${results.length}`,
				[],
				state.pos,
			)
		})
	}
}

/**
 * Creates a parser that matches zero or more occurrences of the input parser.
 *
 * @param parser - The parser to repeat
 * @returns A parser that produces an array of all matches
 */
export const many0 = <S, T>(
	parser: Parser<T>,
	separator?: Parser<S>,
) => many_<S, T>(0)(parser, separator)

/**
 * Creates a parser that matches one or more occurrences of the input parser.
 *
 * @param parser - The parser to repeat
 * @returns A parser that produces an array of all matches (at least one)
 */
export const many1 = <S, T>(
	parser: Parser<T>,
	separator?: Parser<S>,
) => many_<S, T>(1)(parser, separator)

/**
 * Creates a parser that matches exactly n occurrences of the input parser.
 *
 * @param parser - The parser to repeat
 * @param n - Number of required repetitions
 * @returns A parser that produces an array of exactly n matches
 */
export const manyN = <S, T>(
	parser: Parser<T>,
	n: number,
	separator?: Parser<S>,
) => many_<S, T>(n)(parser, separator)

/**
 * Internal helper function for creating skipping repetition parsers.
 *
 * @param count - Minimum number of repetitions required
 * @returns A function that creates a parser skipping multiple occurrences
 */
export function skipMany_<T>(count: number) {
	return (parser: Parser<T>): Parser<undefined> => {
		return Parser.gen(function* () {
			for (let i = 0; i < count; i++) {
				const result = yield* optional(parser)
				if (!result) {
					return yield* Parser.fail(
						`Expected at least ${count} occurrences, but only found ${i}`,
					)
				}
			}
			return undefined
		}) as Parser<undefined>
	}
}

/**
 * Creates a parser that skips zero or more occurrences of the input parser.
 *
 * @param parser - The parser to skip
 * @returns A parser that skips all matches
 */
export const skipMany0 = <T>(parser: Parser<T>) =>
	skipMany_<T>(0)(parser)

/**
 * Creates a parser that skips one or more occurrences of the input parser.
 *
 * @param parser - The parser to skip
 * @returns A parser that skips all matches (requires at least one)
 */
export const skipMany1 = <T>(parser: Parser<T>) =>
	skipMany_<T>(1)(parser)

/**
 * Creates a parser that skips exactly n occurrences of the input parser.
 *
 * @param parser - The parser to skip
 * @param n - Number of required repetitions to skip
 * @returns A parser that skips exactly n matches
 */
export const skipManyN = <T>(
	parser: Parser<T>,
	n: number,
) => skipMany_<T>(n)(parser)

/**
 * Creates a parser that skips input until the given parser succeeds.
 *
 * @param parser - The parser to look for
 * @returns A parser that skips input until a match is found
 */
export function skipUntil<T>(
	parser: Parser<T>,
): Parser<undefined> {
	return Parser.gen(function* () {
		while (true) {
			const result = yield* optional(parser)
			if (!result) {
				return undefined
			}
		}
	})
}

/**
 * A parser that skips any number of space characters.
 */
export const skipSpaces = new Parser(
	(state) =>
		Parser.succeed(
			undefined,
			State.consumeWhile(state, (char) => char === " "),
		),
	{ name: "skipSpaces" },
)

/**
 * Creates a parser that tries multiple parsers in order until one succeeds.
 *
 * @param parsers - Array of parsers to try
 * @returns A parser that succeeds if any of the input parsers succeed
 */
export function or<T>(
	...parsers: Array<Parser<T>>
): Parser<T> {
	return Parser.gen(function* () {
		for (const parser of parsers) {
			const result = yield* optional(parser)
			if (result) {
				return result
			}
		}

		return yield* Parser.fail(
			`None of the ${parsers.length} choices could be satisfied`,
			parsers
				.filter((x) => x.options?.name != null)
				.map((p) => p.options?.name ?? ""),
		)
	}) as Parser<T>
}

/**
 * Creates a parser that optionally matches the input parser.
 * If the parser fails, returns undefined without consuming input.
 *
 * @param parser - The parser to make optional
 * @returns A parser that either succeeds with a value or undefined
 */
export function optional<T>(
	parser: Parser<T>,
): Parser<T | undefined> {
	return new Parser((state) => {
		const result = parser.parse(state)
		if (Either.isLeft(result)) {
			return Parser.succeed(undefined, state)
		}
		return result
	})
}

/**
 * Creates a parser that runs multiple parsers in sequence.
 * Returns the result of the last parser in the sequence.
 *
 * @param parsers - Array of parsers to run in sequence
 * @returns A parser that succeeds if all parsers succeed in sequence
 */
export function sequence<T>(
	parsers: Parser<T>[],
): Parser<T> {
	return new Parser((state) => {
		const results: T[] = []
		let currentState = state

		for (const parser of parsers) {
			const result = parser.parse(currentState)
			if (Either.isLeft(result)) {
				return result
			}
			const [value, newState] = result.right
			results.push(value)
			currentState = newState
		}

		return Either.right([
			results.at(-1),
			currentState,
		]) as any
	})
}

/**
 * Creates a parser that chains two parsers together, where the second parser
 * depends on the result of the first parser.
 *
 * @param parser - The first parser to run
 * @param fn - Function that takes the result of the first parser and returns a new parser
 * @returns A parser that chains the two parsers together
 */
export const chain = <T, U>(
	parser: Parser<T>,
	fn: (value: T) => Parser<U>,
): Parser<U> => {
	return new Parser((state) => {
		const result = parser.parse(state)
		if (Either.isLeft(result)) {
			return result
		}
		const [value, newState] = result.right
		return fn(value).parse(newState)
	})
}

/**
 * Creates a parser that matches input against a regular expression.
 * The regex must match at the start of the input.
 *
 * @param re - The regular expression to match against
 * @returns A parser that matches the regex pattern
 */
export const regex = (re: RegExp): Parser<string> => {
	return new Parser(
		(state) => {
			const match = re.exec(state.remaining)
			if (match && match.index === 0) {
				const value = match[0]
				return Parser.succeed(value, state)
			}
			return Parser.error(
				`Expected ${re} but found ${state.remaining.slice(0, 10)}...`,
				[re.toString()],
				state.pos,
			)
		},
		{ name: re.toString() },
	)
}
