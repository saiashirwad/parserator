# Fast Path

Fast-path execution uses mutable context and object pooling for better performance. It provides a significant speedup (typically 15-20%) by minimizing object allocations and GC pressure during parsing.

## MutableParserContext

`MutableParserContext` is an internal class used during fast-path parsing. Instead of creating new immutable state objects, the parser mutates this context in-place.

```typescript
class MutableParserContext {
  /** The complete original input string */
  source: string;
  /** Current byte offset from start of input (0-indexed) */
  offset: number;
  /** Current line number (1-indexed) - computed lazily on error */
  line: number;
  /** Current column number (1-indexed) - computed lazily on error */
  column: number;
  /** Whether the parser has committed to this parse path */
  committed: boolean;
  /** Stack of parsing context labels for error reporting */
  labelStack: string[];
  /** The furthest error encountered during parsing (null if no error yet) */
  error: ParseError | null;
  /** Offset where the error occurred */
  errorOffset: number;
  /** Custom error message from .expect() */
  expectMessage: string | null;

  /** Gets the character at current offset without allocating */
  charAt(): string;
  /** Checks if remaining input starts with the given string */
  startsWith(str: string): boolean;
  /** Advances the offset by n characters (lazy line/column update) */
  advance(n: number): void;
  /** Returns the remaining unparsed portion of the input */
  remaining(): string;
  /** Checks if at end of input */
  isAtEnd(): boolean;
  /** Records an error if it's further than any previous error */
  recordError(error: ParseError): void;
  /** Records an expect message at the current offset */
  recordExpect(message: string): void;
}
```

## ContextPool

`ContextPool` is an object pool that reuses `MutableParserContext` instances to reduce garbage collection pressure. This is particularly effective when parsing many small inputs in a loop.

```typescript
class ContextPool {
  /** Retrieves a context from the pool or creates a new one */
  acquire(source: string): MutableParserContext;
  /** Returns a context to the pool for later reuse */
  release(ctx: MutableParserContext): void;
  /** Clears all pooled contexts */
  clear(): void;
}
```

## Using parseFast()

The `parseFast()` method is the entry point for fast-path execution. It automatically uses the global `contextPool`.

```typescript
import { string } from "parserator";

const hello = string("hello");

// parseFast() uses ContextPool automatically
const result = hello.parseFast("hello");

// Equivalent to parse() but faster for repeated calls
// result is a ParserOutput<T>
```

## When to Use

- **High-throughput parsing**: Parsing many inputs in a tight loop.
- **Batch processing**: Server-side processing of multiple records.
- **Performance-critical paths**: Code where parsing speed is a bottleneck.

## When NOT to Use

- **One-shot parsing**: The setup overhead of the context pool might outweigh the benefits for a single small parse.
- **Debugging**: Immutable state is easier to inspect during step-through debugging.
- **Custom state requirements**: If your custom parser logic relies on immutable state transitions in `ParserState`.
