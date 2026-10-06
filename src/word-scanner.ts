import { SourceText } from "./errors.ts"
import {
  makeParser,
  replyFailure,
  replySuccess,
  type Parser
} from "./parser.ts"
import { generateHints } from "./suggestions.ts"

export const defaultWord = /[\p{L}_][\p{L}\p{N}_'.-]*/u

export function wordScanner(expression: RegExp, vocabulary: readonly string[]) {
  const sticky = new RegExp(
    expression.source,
    `${expression.flags.replace(/[gy]/g, "")}y`
  )
  const scan = (source: SourceText, offset: number): string | undefined => {
    sticky.lastIndex = offset
    const match = sticky.exec(source.text)
    if (match?.index !== offset) return undefined
    if (!match[0].length) throw new TypeError("identifier must consume input")
    return match[0]
  }
  sticky.lastIndex = 0
  if (sticky.exec("")?.[0] === "")
    throw new TypeError("identifier must consume input")
  for (const word of vocabulary) {
    if (!word || scan(new SourceText(word), 0) !== word)
      throw new TypeError(
        "keywords must be nonempty complete identifier matches"
      )
  }
  const identifier = makeParser((source, offset) => {
    const word = scan(source, offset)
    return word === undefined
      ? replyFailure(
          {
            kind: "expected",
            span: { start: offset, end: offset + source.charWidthAt(offset) },
            expected: [expression.toString()],
            ...(source.charAt(offset) ? { found: source.charAt(offset) } : {})
          },
          offset
        )
      : replySuccess(word, offset + word.length)
  })
  const keyword = (candidates: readonly string[]): Parser<string> =>
    makeParser((source, offset) => {
      const word = scan(source, offset)
      if (word !== undefined && candidates.includes(word))
        return replySuccess(word, offset + word.length)
      const found = word?.toWellFormed() ?? source.charAt(offset)
      const hints = generateHints(found, vocabulary)
      return replyFailure(
        {
          kind: "expected",
          span: { start: offset, end: offset + found.length },
          expected: candidates.map(word => JSON.stringify(word)),
          ...(found ? { found } : {}),
          ...(hints.length ? { hints } : {})
        },
        offset
      )
    })
  return { identifier, keyword }
}
