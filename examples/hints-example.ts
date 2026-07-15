import {
  anyKeywordWithHints,
  char,
  many0,
  many1,
  sequence
} from "../src/index.ts"

const keyword = anyKeywordWithHints(["name", "hi", "typescript"])

export const dollarKeyword = sequence([
  many1(char("$")),
  many0(char(".")),
  keyword
])
