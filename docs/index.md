---
layout: home
hero:
  name: "Parserator"
  text: "Type-safe Parser Combinators"
  tagline: Build parsers by composing small functions. No grammar files, no code generation.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /api/
    - theme: alt
      text: GitHub
      link: https://github.com/saiashirwad/parserator

features:
  - icon: ⚙️
    title: Generator Syntax
    details: Write parsers with yield* for natural sequencing and readable logic.
  - icon: 🛡️
    title: Type-Safe
    details: Full TypeScript inference from input to output. No more "any" in your AST.
  - icon: 🎯
    title: Great Errors
    details: Automatic position tracking, context stacks, and typo suggestions.
  - icon: 📦
    title: Zero Dependencies
    details: Small bundle size with no runtime overhead. Just pure TypeScript.
---

## Quick Example

Showcase how easy it is to build complex parsers using generator syntax.

```typescript
import { parser, char, many1, digit, string, or, commit } from "parserator";

// Parse a simple expression like "add(1, 2)" or "mul(3, 4)"
const number = many1(digit).map(d => parseInt(d.join("")));

const expr = parser(function* () {
  const op = yield* or(string("add"), string("mul"));
  yield* commit(); // Better errors after this point
  yield* char("(");
  const a = yield* number;
  yield* char(",");
  const b = yield* number;
  yield* char(")");
  return op === "add" ? a + b : a * b;
});

expr.parseOrThrow("add(1, 2)"); // 3
expr.parseOrThrow("mul(3, 4)"); // 12
```

## Why Parserator?

Parserator bridges the gap between the simplicity of Regex and the power of formal grammar tools.

| Approach          | Nested Structures | Type Safety | Debugging            |
| ----------------- | ----------------- | ----------- | -------------------- |
| **Regex**         | No                | No          | Hard                 |
| **Grammar Tools** | Yes               | Limited     | Generated code       |
| **Parserator**    | **Yes**           | **Full**    | **Normal debugging** |

## Installation

Get started with your favorite package manager.

```bash
npm install parserator
# or
bun add parserator
```
