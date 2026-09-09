import {
  createParserEngine,
  type CoreParser,
  type CoreParseResult,
  type IncrementalResult as CoreIncrementalResult,
  type IncrementalParser as CoreIncrementalParser,
  type CorePrefixResult
} from "./core.ts"
import { textInput } from "./incremental-input.ts"
import { ParseError, SourceText } from "./errors.ts"
import { codePointAt, State } from "./state.ts"

export type IncrementalResult<T> = CoreIncrementalResult<T, string, ParseError>
export type IncrementalParser<T> = CoreIncrementalParser<T, string, ParseError>

export type Parser<T> = CoreParser<T, string, ParseError>
export type ParseResult<T> = CoreParseResult<T, ParseError>
export type PrefixResult<T> = CorePrefixResult<T, string>
export type PrefixParseResult<T> = ParseResult<PrefixResult<T>>

export const textEngine = createParserEngine<string, ParseError>({
  fromInput: State.fromInput,
  incrementalInput: textInput,
  isAtEnd: State.isAtEnd,
  remaining: State.remaining,
  peek: state => codePointAt(state.source, state.offset),
  failureOffset: diagnostic => diagnostic.span.start,
  error: (diagnostic, input, sourceName) =>
    new ParseError(diagnostic, new SourceText(input, sourceName))
})

export const {
  Parser,
  makeParser,
  makeRead,
  makeResumable,
  runParser,
  runResumable,
  replySuccess,
  failRich,
  failureAt,
  expected,
  mergeFailures,
  parser,
  recursive,
  succeed,
  fail,
  fatal
} = textEngine
