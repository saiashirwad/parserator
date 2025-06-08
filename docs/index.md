---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Parserator"
  text: "Elegant Parser Combinators for TypeScript"
  tagline: Build powerful parsers with composable, type-safe combinators
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/saiashirwad/parserator
    - theme: alt
      text: API Reference
      link: /api/

features:
  - icon: 🧩
    title: Composable
    details: Build complex parsers by combining simple, reusable pieces. Start small and compose your way to powerful parsing solutions.
  - icon: 🛡️
    title: Type-Safe
    details: Full TypeScript support with excellent type inference. Get compile-time guarantees and rich IDE support.
  - icon: ⚡
    title: Performant
    details: Optimized for real-world use cases with minimal overhead. Parse large inputs efficiently.
  - icon: 🎯
    title: Developer Friendly
    details: Clear error messages, intuitive API, and comprehensive documentation make parsing accessible to everyone.
---

## Quick Example

```typescript
import { string, number, sequence, many, map } from "parserator";

// Parse a simple arithmetic expression
const digit = number();
const operator = string("+").or(string("-"));
const expression = sequence(digit, many(sequence(operator, digit)));

const result = expression.parse("1+2-3+4");
console.log(result); // Success with parsed AST
```

## Installation

```bash
# Using npm
npm install parserator

# Using yarn
yarn add parserator

# Using pnpm
pnpm add parserator

# Using bun
bun add parserator
```

## Why Parserator?

### Simple Yet Powerful

Start with basic parsers and combine them to handle complex grammars. No need to learn a separate grammar syntax - it's just TypeScript.

### Battle-Tested Patterns

Based on proven parser combinator techniques used in functional programming languages, adapted for the TypeScript ecosystem.

### Excellent Error Recovery

Get helpful error messages that point to exactly where parsing failed, with context about what was expected.

### Zero Dependencies

Parserator has no runtime dependencies, keeping your bundle size small and your builds fast.

## Ready to Start?

Check out the [Getting Started guide](/guide/getting-started) to begin building your first parser, or explore the [API Reference](/api/) to see all available combinators.

<div style="margin-top: 4rem; text-align: center; color: var(--vp-c-text-2);">
  Made with ❤️ by <a href="https://bsky.app/profile/texoport.in" target="_blank">Sai</a>
</div>
