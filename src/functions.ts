import { Either } from "./either"
import type { ParserState, ParserOutput } from "./types"
import { ParserError, printErrorContext } from "./errors"

export const succeed = <T, Ctx = {}>(
	value: T,
	state: ParserState<Ctx>,
): ParserOutput<T, Ctx> => ({
	state,
	result: Either.right(value),
})

export const fail = <Ctx = {}>(
	error: { message: string; expected?: string[]; found?: string },
	state: ParserState<Ctx>,
): ParserOutput<never, Ctx> => ({
	state,
	result: Either.left(
		new ParserError(
			error.message.startsWith("Parser Error:")
				? error.message
				: printErrorContext(state, error.message),
			error.expected ?? [],
			error.found,
		),
	),
})
