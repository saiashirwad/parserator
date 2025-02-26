import { char, digit, many1 } from "../src"

const number = many1(digit)
	.map((s) => parseInt(s.join("")))
	.withError(() => "Expected a number")

const p = number.thenDiscard(char("\n"))

const pp = many1(p)

const result3 = p.parseOrThrow("something\nelse\n23\n32\n5")
console.log(result3)
