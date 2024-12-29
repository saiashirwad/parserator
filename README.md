# Parserator

> **Warning**
> This library is currently in early development and the API is subject to change. Don't use, even at your own risk.

A parser combinator library inspired by [Parsec](https://github.com/haskell/parsec) and [Effect-TS](https://github.com/Effect-ts/Effect).

## Installation

```bash
npm install @texoport/parserator
```

## Usage

### Generator Syntax

```ts
const parser = new Parser(function* () {
  const a = yield* char("a")
  const b = yield* char("b")
  return { a, b }
})

const result = parser.run("ab")
```
