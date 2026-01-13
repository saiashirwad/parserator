# Performance

For most use cases, Parserator's regular `parse()` method is fast enough. However, for performance-critical code, hot loops, or server-side batch processing, Parserator provides a "fast-path" execution mode and hand-optimized combinators that can deliver **6-260x speedups**.

## `parseFast()` - Fast Path Execution

Regular parsing in Parserator uses immutable state objects to enable easy backtracking and debugging. While this is great for development, it creates object allocation pressure during high-frequency parsing.

The `parseFast()` method uses a **mutable context** and **object pooling** to eliminate GC pressure.

```typescript
import { myParser } from "./parser";

// Regular parsing (Immutable state, creates new objects)
const result = myParser.parse(input);

// Fast path (Mutable context, zero allocations)
const result = myParser.parseFast(input);
```

### Key Differences

- **Mutable Context**: Uses `MutableParserContext` instead of creating a new `ParserState` for every operation.
- **Object Pooling**: Reuses context objects from a pool to minimize Garbage Collection (GC) pauses.
- **Backtracking**: Uses snapshot/restore points instead of deep copies.
- **Speedup**: Typically **1.5x to 2x faster** for standard parsers with no code changes.

### When to Use

- Parsing many small inputs in a loop.
- Performance-critical hot paths in a complex grammar.
- High-throughput server-side applications.

---

## Optimized Combinators

For common patterns like digit matching or whitespace skipping, Parserator provides specialized combinators that bypass the regex engine and generic combinator overhead.

```typescript
import {
  manyDigit,
  many1Digit,
  manyAlphabet,
  many1Alphabet,
  manyAlphanumeric,
  skipWhitespace,
  oneOfChars,
  anyOfStrings
} from "parserator";
```

### Comparison table

| Regular Pattern                     | Optimized Combinator          | Speedup  |
| :---------------------------------- | :---------------------------- | :------- |
| `many(digit)`                       | `manyDigit()`                 | **7x**   |
| `many1(digit)`                      | `many1Digit()`                | **7x**   |
| `many(alphabet)`                    | `manyAlphabet()`              | **7x**   |
| `many(regex(/[a-zA-Z0-9]/))`        | `manyAlphanumeric()`          | **7x**   |
| `many(regex(/\s/))`                 | `skipWhitespace()`            | **5x**   |
| `or(char("a"), char("b"), ...)`     | `oneOfChars("abc")`           | **1.5x** |
| `or(string("if"), string("while"))` | `anyOfStrings("if", "while")` | **1.5x** |

---

## How it Works

Optimized combinators achieve their speed by providing a direct "fast-path" implementation that the `Parser` class picks up when running in `parseFast()` mode.

### Regular Combinators

A generic combinator like `many(digit)` creates a `Parser` object that iterates and calls the `digit` parser repeatedly. Each iteration involves function call overhead and result checking.

```typescript
// Generic approach
many(digit); // High function call overhead
```

### Optimized Combinators

An optimized combinator like `manyDigit()` implements a tight `while` loop that checks character codes directly.

```typescript
// Optimized approach (Internally)
while (offset < source.length) {
  const ch = source[offset];
  if (ch >= "0" && ch <= "9") {
    results.push(ch);
    offset++;
  } else {
    break;
  }
}
```

**Key Optimizations:**

- **No Regex Overhead**: Direct character range comparisons (`ch >= "0"`) are significantly faster than regex engine execution.
- **Inlined Loops**: Eliminates the overhead of calling a sub-parser thousands of times.
- **Zero Allocations**: When using `skipWhitespace()`, no intermediate arrays are created at all.

---

## Benchmarks

Real-world results measured on a modern JS engine (Bun/V8):

| Task                   | Baseline (`parse`) | Optimized (`parseFast`) | Improvement        |
| :--------------------- | :----------------- | :---------------------- | :----------------- |
| **Identifier Parsing** | 122.78 µs          | 473.49 ns               | **259x faster** ✨ |
| **JSON Parsing**       | 3.30 ms            | 556.13 µs               | **5.9x faster**    |
| **many(digit)**        | 64.46 µs           | 9.04 µs                 | **7.1x faster**    |

---

## Performance Best Practices

1. **Profile First**: Don't optimize blindly. Use a profiler to identify which parts of your grammar are actually slow.
2. **Use `parseFast()` in Production**: If you don't need the step-by-step immutable state for debugging, `parseFast()` is a drop-in replacement that is always faster.
3. **Replace Hot-Path Combinators**: If your parser spends 80% of its time parsing identifiers or numbers, replace generic `many(digit)` with `manyDigit()`.
4. **Avoid Unnecessary Backtracking**: Use `commit()` once you've identified a branch (e.g., after parsing the `function` keyword) to prevent the parser from trying other branches on failure.
5. **Use `skipWhitespace()`**: In most grammars, whitespace is discarded. Using `skipWhitespace()` instead of `many(whitespace)` avoids allocating arrays of strings that will immediately be thrown away.

## When NOT to Optimize

- **Development & Prototyping**: The regular `parse()` method provides better debugging metadata.
- **One-shot Parsing**: If you're parsing a single config file once at startup, the milliseconds saved aren't worth the extra complexity.
- **Simple Grammars**: If your parser is already running in sub-microsecond time, stay with the most readable code.
