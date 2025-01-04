import { Parser, char, digit, many1 } from "../src"

const lol = char("a")

console.log(lol.parse("b"))
