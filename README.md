# Parserator

> **Warning**
> This library is currently in early development and the API is subject to change. There are *several* bugs. Please don't use, even at your own risk. I am absolutely responsible for any bugs, so holler at me at [@texoport.in](https://bsky.app/profile/texoport.in).

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
