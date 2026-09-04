import { choice, eof, literal, lookahead } from "./combinators.ts"
import {
  anyKeywordWithHints,
  generateHints,
  keywordWithHints
} from "./hints.ts"
import {
  fail,
  failRich,
  makeParser,
  replySuccess,
  runParser,
  succeed,
  type Parser
} from "./parser.ts"
import { State, type ParserReply } from "./state.ts"

/** Options used to build a small character-stream lexer. */
export type LexemeOptions<K extends readonly string[]> = {
  readonly trivia: Parser<unknown>
  /** A raw identifier parser. Its full match also sets keyword boundaries. */
  readonly identifier: Parser<string>
  readonly keywords?: K
}

/** The parsers and helpers created by {@link createLexemes}. */
export type Lexemes<K extends readonly string[]> = {
  readonly trivia: Parser<unknown>
  readonly identifier: Parser<string>
  readonly token: <T>(parser: Parser<T>) => Parser<T>
  readonly symbol: <const S extends string>(symbol: S) => Parser<S>
  readonly keyword: <const W extends K[number]>(word: W) => Parser<W>
  readonly complete: <T>(parser: Parser<T>) => Parser<T>
}

/**
 * Builds the common lexical layer for a character-stream grammar.
 *
 * `token` consumes trailing trivia. Use `complete` at the public boundary so
 * leading trivia is accepted too. Keywords are boundary-safe and never cut a
 * grammar branch; the grammar decides where to commit.
 */
export function createLexemes<const K extends readonly string[]>(
  options: LexemeOptions<K>
): Lexemes<K> {
  const configuredKeywords = [...new Set(options.keywords ?? [])]
  if (configuredKeywords.some(keyword => keyword.length === 0)) {
    throw new TypeError("keywords must not contain an empty string")
  }
  const hintedKeyword = keywordWithHints(configuredKeywords)
  const keywordAtIdentifierBoundary = (
    candidates: readonly string[],
    fallback: Parser<string>
  ): Parser<string> => {
    const longestFirst = [...candidates].sort((a, b) => b.length - a.length)
    return makeParser(state => {
      const matching = longestFirst.filter(word =>
        State.startsWith(state, word)
      )
      if (!matching.length) return runParser(fallback, state)

      const identifier = runParser(options.identifier, state)
      if (
        !identifier.result.ok &&
        identifier.result.failure.control.kind === "fatal"
      ) {
        return identifier as ParserReply<never> as ParserReply<string>
      }
      const identifierEnd = identifier.result.ok
        ? identifier.state.offset
        : state.offset
      const word = matching.find(
        candidate => identifierEnd <= state.offset + candidate.length
      )
      if (word) return replySuccess(word, State.consume(state, word.length))

      const found = state.source.slice(state.offset, identifierEnd)
      const hints = generateHints(found, configuredKeywords)
      return failRich(
        {
          diagnostic: {
            kind: "expected",
            span: { start: state.offset, end: identifierEnd },
            expected: longestFirst.map(value => JSON.stringify(value)),
            found,
            ...(hints.length ? { hints } : {})
          },
          control: {
            kind: "recoverable",
            cutGeneration: state.cutGeneration
          }
        },
        state
      ) as ParserReply<string>
    })
  }
  const keywordEndProbe = configuredKeywords.length
    ? lookahead(
        keywordAtIdentifierBoundary(
          configuredKeywords,
          anyKeywordWithHints(configuredKeywords)
        )
      ).flatMap(word =>
        fail(`Unexpected trailing keyword ${JSON.stringify(word)}`)
      )
    : undefined
  const end = keywordEndProbe ? choice(keywordEndProbe, eof) : eof
  const token = <T>(parser: Parser<T>): Parser<T> =>
    parser.zipLeft(options.trivia)

  const keyword = <const W extends K[number]>(word: W): Parser<W> => {
    if (!(configuredKeywords as readonly string[]).includes(word))
      throw new RangeError(`Keyword ${JSON.stringify(word)} is not configured`)
    return token(
      keywordAtIdentifierBoundary([word], hintedKeyword(word))
    ) as Parser<W>
  }

  const identifier = token(
    options.identifier
      .withSpan((value, span) => ({ value, span }))
      .flatMap(({ value, span }) =>
        configuredKeywords.includes(value)
          ? makeParser(state =>
              failRich(
                {
                  diagnostic: {
                    kind: "custom",
                    span,
                    message: `${JSON.stringify(value)} is a reserved keyword`
                  },
                  control: {
                    kind: "recoverable",
                    cutGeneration: state.cutGeneration
                  }
                },
                state
              )
            )
          : succeed(value)
      )
  )

  return {
    trivia: options.trivia,
    identifier,
    token,
    symbol: <const S extends string>(symbol: S): Parser<S> =>
      token(literal(symbol)) as Parser<S>,
    keyword,
    complete: <T>(parser: Parser<T>): Parser<T> =>
      completeParser(parser, options.trivia, end)
  }
}

function addContext<T>(
  reply: ParserReply<T>,
  context: readonly string[] | undefined
): ParserReply<T> {
  if (reply.result.ok || !context?.length) return reply
  const diagnostic = reply.result.failure.diagnostic
  return failRich(
    {
      ...reply.result.failure,
      diagnostic: {
        ...diagnostic,
        context: [...(diagnostic.context ?? []), ...context]
      }
    },
    reply.state
  ) as ParserReply<T>
}

function completeParser<T>(
  inner: Parser<T>,
  trivia: Parser<unknown>,
  end: Parser<unknown>
): Parser<T> {
  return makeParser(state => {
    const leading = runParser(trivia, state)
    if (!leading.result.ok)
      return leading as ParserReply<never> as ParserReply<T>

    const parsed = runParser(inner, leading.state)
    if (!parsed.result.ok) return parsed
    const context = parsed.state.completionContext

    const trailing = runParser(trivia, parsed.state)
    if (!trailing.result.ok)
      return addContext(trailing, context) as ParserReply<T>

    const finished = runParser(end, trailing.state)
    if (!finished.result.ok)
      return addContext(finished, context) as ParserReply<T>
    return replySuccess(parsed.result.value, finished.state)
  })
}
