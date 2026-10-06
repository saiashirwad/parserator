import { eof, literal } from "./combinators.ts"
import { makeParser, replyFailure, succeed, type Parser } from "./parser.ts"
import { wordScanner } from "./word-scanner.ts"

export type LexemeOptions<K extends readonly string[]> = {
  readonly trivia: Parser<unknown>
  readonly identifier: RegExp
  readonly keywords?: K
}

export type Lexemes<K extends readonly string[]> = {
  readonly trivia: Parser<unknown>
  readonly identifier: Parser<string>
  readonly token: <T>(parser: Parser<T>) => Parser<T>
  readonly symbol: <const S extends string>(symbol: S) => Parser<S>
  readonly keyword: <const W extends K[number]>(word: W) => Parser<W>
  readonly complete: <T>(parser: Parser<T>) => Parser<T>
}

export function createLexemes<const K extends readonly string[]>(
  options: LexemeOptions<K>
): Lexemes<K> {
  const keywords = [...new Set(options.keywords ?? [])]
  const scanner = wordScanner(options.identifier, keywords)
  const token = <T>(parser: Parser<T>): Parser<T> =>
    parser.zipLeft(options.trivia)
  const identifier = token(
    scanner.identifier
      .withSpan((value, span) => ({ value, span }))
      .flatMap(({ value, span }) =>
        keywords.includes(value)
          ? makeParser((_source, offset) =>
              replyFailure(
                {
                  kind: "custom",
                  span,
                  message: `${JSON.stringify(value)} is a reserved keyword`
                },
                offset
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
      token(literal(symbol)),
    keyword: <const W extends K[number]>(word: W): Parser<W> => {
      if (!keywords.includes(word))
        throw new RangeError(
          `Keyword ${JSON.stringify(word)} is not configured`
        )
      return token(scanner.keyword([word])) as Parser<W>
    },
    complete: <T>(parser: Parser<T>): Parser<T> =>
      options.trivia.zipRight(parser).zipLeft(options.trivia).zipLeft(eof)
  }
}
