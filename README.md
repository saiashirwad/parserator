# Parserator

> **Warning**
> This library is currently in early development and the API is subject to change. There are *several* bugs. Please don't use, even at your own risk. I am absolutely responsible for any bugs, so holler at me at [@texoport.in](https://bsky.app/profile/texoport.in).

A TypeScript parser combinator library inspired by [Parsec](https://github.com/haskell/parsec) and [Effect-TS](https://github.com/Effect-ts/Effect). Write parsers using a clean, generator-based syntax or compose them using functional combinators.

## Features

* 🎯 **Generator Syntax**: Write parsers using a clean, async-like syntax
* 🔧 **Functional Combinators**: Compose parsers using functional programming patterns
* 🎭 **Type-Safe**: Full TypeScript support with precise type inference
* 📦 **Zero Dependencies**: No external dependencies, just pure TypeScript
* 🐛 **Great Error Messages**: Helpful error messages with source positions
* 🚀 **Fast?**: I wouldn't know, this could be the slowest thing in the known universe.

## Examples

```ts
export const integer2: Parser<number> = Parser.gen(
	function* () {
		const sign = yield* optional(char("-"))
		const digits = yield* manyN(digit, 2).errorCallback(
			(error, state) => {
				console.log(state)
				return `WUT, i need 2 digits, minimum, at ${State.printPosition(state)}`
			},
		)
		const numStr = (sign ?? "") + digits.join("")
		return parseInt(numStr, 10)
	},
).withName("integer2")

export const float: Parser<number> = Parser.gen(
	function* () {
		const sign = yield* optional(char("-"))
		const intPart = yield* many1(digit)
		const fractionalPart = yield* optional(
			Parser.gen(function* () {
				yield* char(".")
				return yield* many1(digit)
			}),
		)
		const exponentPart = yield* optional(
			Parser.gen(function* () {
				yield* char("e")
				const expSign = yield* optional(
					or(char("+"), char("-")),
				)
				const expDigits = yield* many1(digit)
				return (expSign ?? "") + expDigits.join("")
			}),
		)

		const numStr =
			(sign ?? "") +
			intPart.join("") +
			(fractionalPart
				? "." + fractionalPart.join("")
				: "") +
			(exponentPart ? "e" + exponentPart : "")

		console.log(numStr)

		return parseFloat(numStr)
	},
)

```

## Installation

```bash
npm install parserator
```

## Quick Start

### Generator Syntax

Write parsers using a clean, generator-based syntax that feels like async/await:

```typescript
import { Parser, char } from 'parserator'

const parser = new Parser(function* () {
  const a = yield* char("a")
  const b = yield* char("b")
  return { a, b }
})

parser.run("ab") // Right([{ a: "a", b: "b" }, ...])
parser.run("ac") // Left(ParserError: Expected 'b' but found 'c')
```

### Functional Combinators

Or use functional combinators for more complex parsing:

```typescript
import { char, many1, sepBy, between } from 'parserator'

// Parse a comma-separated list of 'a's between parentheses: (a,a,a)
const listParser = between(
  char("("), char(")"),
  sepBy(char(","), char("a"))
)

listParser.run("(a,a,a)") // Right([["a", "a", "a"], ...])
```

# more docs coming soon!
