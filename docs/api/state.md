# State

## ParserState Type

The `ParserState` object represents the complete state of a parser at any point during execution. It is an immutable structure that tracks the source, current position, and parsing context.

```typescript
type ParserState = {
  source: string;      // Original input string
  offset: number;      // 0-indexed byte offset from start
  line: number;        // 1-indexed line number
  column: number;      // 1-indexed column number
  committed?: boolean; // Whether commit() was called in current branch
  labelStack?: string[]; // Stack of labels for context-aware errors
  debug?: boolean;     // Whether debug mode is enabled
};
```

### SourcePosition

A simplified view of the parser's location in the source.

```typescript
type SourcePosition = {
  offset: number; // 0-indexed byte offset
  line: number;   // 1-indexed line
  column: number; // 1-indexed column
};
```

## State Utilities

The `State` object provides low-level functions for creating and manipulating `ParserState`. These are typically used when implementing custom parsers.

### State.fromInput()
Creates an initial `ParserState` from an input string, initialized at line 1, column 1, offset 0.

```typescript
State.fromInput(input: string): ParserState
```

### State.consume()
Advances the parser state by `n` characters. It updates the `offset` but leaves `line` and `column` as-is (they are computed lazily or by `State.computePosition` when needed for errors).

```typescript
State.consume(state: ParserState, n: number): ParserState
```

### State.consumeString()
Consumes a specific string from the current position. Throws an error if the remaining input does not start with the specified string.

```typescript
State.consumeString(state: ParserState, str: string): ParserState
```

### State.consumeWhile()
Consumes characters while the provided predicate function returns `true`. Returns a new `ParserState` updated to the position after the last matching character.

```typescript
State.consumeWhile(
  state: ParserState, 
  predicate: (char: string) => boolean
): ParserState
```

### State.peek()
Looks at the next `n` characters (default: 1) without advancing the parser state.

```typescript
State.peek(state: ParserState, n?: number): string
```

### State.isAtEnd()
Returns `true` if the current offset has reached or exceeded the length of the source string.

```typescript
State.isAtEnd(state: ParserState): boolean
```

### State.remaining()
Returns the unparsed portion of the source string starting from the current offset.

```typescript
State.remaining(state: ParserState): string
```
