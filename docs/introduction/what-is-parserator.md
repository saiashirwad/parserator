# What is Parserator?

Parserator is a library for building powerful, type-safe parsers by composing small, reusable functions—allowing you to handle complex data formats with the ease of writing standard TypeScript.

## The Problem

Parsing data is a common task, but traditional tools often force trade-offs between readability, maintainability, and power.

**Regex** is the go-to for simple patterns, but it quickly becomes a "write-only" language as complexity grows. It cannot handle nested or recursive structures (like JSON or HTML) and offers no type safety for its matches.

**Grammar Generators** (like ANTLR or PEG.js) are powerful but come with heavy baggage. They require learning a separate DSL, involve complex code-generation build steps, and often result in poor TypeScript integration where types are either "any" or manually maintained.

**Manual Parsing** involves writing custom loops and state management. While flexible, it is incredibly tedious, error-prone, and difficult to maintain or extend as requirements change.

## The Solution

Parserator uses **Parser Combinators**. You start with tiny functions that parse a single thing (a digit, a character, a string) and "combine" them into larger structures.

By using **TypeScript Generators**, Parserator allows you to write parsers that look and feel like standard imperative code, but with the power of a formal grammar.

```typescript
import { parser, char, many1, digit, string, or } from "parserator";

// 1. Define small, reusable parsers
const number = many1(digit).map(d => parseInt(d.join("")));

// 2. Compose them into larger structures
const operator = or(string("+"), string("-"), string("*"), string("/"));

// 3. Use generator syntax for complex logic
const expression = parser(function* () {
  const left = yield* number;
  const op = yield* operator;
  const right = yield* number;
  return { left, op, right };
});

// 4. Run the parser
const result = expression.parseOrThrow("10+20");
console.log(result); // { left: 10, op: "+", right: 20 }
```

## Key Benefits

- **Type-safe**: Results are automatically inferred by TypeScript. No more `any` types or manual casting.
- **Composable**: Build complex languages by nesting simple, testable building blocks.
- **Readable**: Generator syntax (`yield*`) mirrors the structure of your grammar, making it easy to follow.
- **Debuggable**: Since parsers are just standard functions, you can use your browser or IDE's debugger to step through them.
- **Zero dependencies**: A lightweight library with no external runtime requirements.

## Use Cases

Parserator excels in scenarios where data has a structured, nested, or recursive nature:

- **Configuration Formats**: Build parsers for custom INI, TOML-like, or environment files.
- **Domain-Specific Languages (DSLs)**: Create your own mini-languages for business logic, search queries, or styling.
- **Data Formats**: Handle CSV, JSON, or custom proprietary data formats with ease.
- **Template Engines**: Parse and transform template strings into structured ASTs.
- **Protocol Parsing**: Decode structured messages from network streams or file headers.

## When NOT to Use

While powerful, Parserator isn't always the right tool for every job:

- **Simple String Patterns**: If you just need to check if a string looks like an email or an IP address, a simple **Regex** is faster and more concise.
- **Performance-Critical Hot Paths**: For extremely high-performance needs (parsing gigabytes of JSON per second), a highly optimized, handwritten state machine may outperform combinators.
- **Binary Formats**: Parserator is currently optimized for string-based parsing. For binary data, specialized binary parsing libraries are recommended.

## Next Steps

Ready to build your first parser?

[Getting Started Guide](../guide/getting-started.md)
