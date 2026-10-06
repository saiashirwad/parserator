import {
  makeParser,
  replyFailure,
  replySuccess,
  runParser,
  type Parser
} from "./parser.ts"
import { defaultWord, wordScanner } from "./word-scanner.ts"
import { generateHints } from "./suggestions.ts"

export const keywordWithHints = (keywords: readonly string[]) => {
  const scanner = wordScanner(defaultWord, keywords)
  return (keyword: string): Parser<string> => {
    if (!keywords.includes(keyword))
      throw new RangeError(
        `Keyword ${JSON.stringify(keyword)} is not configured`
      )
    return scanner.keyword([keyword])
  }
}
export function anyKeywordWithHints(
  keywords: readonly string[]
): Parser<string> {
  return wordScanner(defaultWord, keywords).keyword(
    [...keywords].sort((a, b) => b.length - a.length)
  )
}

const quotedString = makeParser<string>((source, offset) => {
  if (source.charAt(offset) !== '"')
    return replyFailure(
      {
        kind: "expected",
        span: { start: offset, end: offset + source.charWidthAt(offset) },
        expected: ["string literal"],
        ...(source.charAt(offset) ? { found: source.charAt(offset) } : {})
      },
      offset
    )
  let end = offset + 1
  let value = ""
  while (end < source.text.length && source.charAt(end) !== '"') {
    value += source.charAt(end)
    end += source.charWidthAt(end)
  }
  if (end >= source.text.length)
    return replyFailure(
      {
        kind: "expected",
        span: { start: end, end },
        expected: ["closing quote"],
        message: "Expected closing quote"
      },
      offset
    )
  return replySuccess(value, end + 1)
})
export function stringWithHints(
  validStrings: readonly string[]
): Parser<string> {
  return makeParser((source, offset) => {
    const reply = runParser(quotedString, source, offset)
    if (!reply.ok || validStrings.includes(reply.value)) return reply
    const hints = generateHints(reply.value, validStrings)
    return replyFailure(
      {
        kind: "unexpected",
        span: { start: offset, end: reply.offset },
        found: JSON.stringify(reply.value),
        ...(hints.length
          ? { hints: hints.map(hint => JSON.stringify(hint)) }
          : {})
      },
      offset
    )
  })
}
