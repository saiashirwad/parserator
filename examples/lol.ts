import {
  char,
  digit,
  many1,
  narrowedString,
  parser,
  skipSpaces,
  string
} from "../src"

const n = many1(digit).map(ds => Number(ds.join("")))
console.log(n)
