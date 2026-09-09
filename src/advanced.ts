/** Low-level construction and state types for advanced integrations. */
export {
  Parser,
  failRich,
  makeParser,
  makeResumable,
  runResumable,
  replySuccess,
  runParser
} from "./parser.ts"
export { ParserOutput, State } from "./state.ts"
export type {
  ParserState,
  ParserReply,
  Reply,
  Success,
  FailureResult
} from "./state.ts"
export type { Failure, FailureControl, Diagnostic, Span } from "./errors.ts"

export { isFinal, waitForInput } from "./core.ts"
