import type { Either } from "./either"
import type { ParserError } from "./errors"

export type Prettify<T> = {
	[K in keyof T]: T[K]
} & {}

export type Last<T> = T extends [...any[], infer L] ? L : never

export type ParserContext<Ctx = {}> = Prettify<
	Ctx & {
		debug?: boolean
		source: string
	}
>

export type SourcePosition = {
	line: number
	column: number
	offset: number
}

export type ParserState<Ctx = {}> = {
	remaining: string
	pos: SourcePosition
	context: ParserContext<Ctx>
}

export type ParserOptions = {
	name?: string
}

export type ParserOutput<T, Ctx = {}> = {
	state: ParserState<Ctx>
	result: Either<T, ParserError>
}
