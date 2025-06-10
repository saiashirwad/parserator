# State

## Functions

### State

```typescript
export const State =
```

Utility object containing static methods for creating and manipulating parser state.

**Parameters:**

- `input` (`string`)

**Returns:** `ParserState`

### fromInput

```typescript
fromInput(input: string): ParserState
```

Creates a new parser state from an input string.

**Parameters:**

- `input` (`string`) - The input string to parse

**Returns:** `ParserState` - A new parser state initialized at the start of the input

### consume

```typescript
consume(state: ParserState, n: number): ParserState
```

Creates a new state by consuming n characters from the current state.

**Parameters:**

- `state` (`ParserState`) - The current parser state
- `n` (`number`) - Number of characters to consume

**Returns:** `ParserState` - A new state with n characters consumed and position updated

### consumeString

```typescript
consumeString(state: ParserState, str: string): ParserState
```

Creates a new state by consuming a specific string from the current state.

**Parameters:**

- `state` (`ParserState`) - The current parser state
- `str` (`string`) - The string to consume

**Returns:** `ParserState` - A new state with the string consumed and position updated

### consumeWhile

```typescript
consumeWhile(
    state: ParserState,
    predicate: (char: string) => ...
```

Creates a new state by consuming characters while a predicate is true.

**Parameters:**

- `state` (`ParserState`) - The current parser state
- `predicate` (`(char: string`) - Function that tests each character

### peek

```typescript
peek(state: ParserState, n: number = 1): string
```

Gets the next n characters from the input without consuming them.

**Parameters:**

- `state` (`ParserState`) - The current parser state
- `n?` (`number`) - Number of characters to peek (default: 1)

**Returns:** `string` - The next n characters as a string

### isAtEnd

```typescript
isAtEnd(state: ParserState): boolean
```

Checks if the parser has reached the end of input.

**Parameters:**

- `state` (`ParserState`) - The current parser state

**Returns:** `boolean` - True if at end of input, false otherwise
