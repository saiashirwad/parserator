# state

## State

**Type:** variable

Utility object containing static methods for creating and manipulating parser state.

*Line 35*

---

## unknown

**Type:** unknown

Utility object containing static methods for creating and manipulating parser state.

*Line 35*

---

## fromInput

**Type:** method

Creates a new parser state from an input string.

**Parameters:**

- `input`: The input string to parse

**Returns:** A new parser state initialized at the start of the input

*Line 42*

---

## unknown

**Type:** unknown

Creates a new parser state from an input string.

**Parameters:**

- `input`: The input string to parse

**Returns:** A new parser state initialized at the start of the input

*Line 42*

---

## consume

**Type:** method

Creates a new state by consuming n characters from the current state.

**Parameters:**

- `state`: The current parser state
- `n`: Number of characters to consume

**Returns:** A new state with n characters consumed and position updated

*Line 54*

---

## unknown

**Type:** unknown

Creates a new state by consuming n characters from the current state.

**Parameters:**

- `state`: The current parser state
- `n`: Number of characters to consume

**Returns:** A new state with n characters consumed and position updated

*Line 54*

---

## consumeString

**Type:** method

Creates a new state by consuming a specific string from the current state.

**Parameters:**

- `state`: The current parser state
- `str`: The string to consume

**Returns:** A new state with the string consumed and position updated

*Line 88*

---

## unknown

**Type:** unknown

Creates a new state by consuming a specific string from the current state.

**Parameters:**

- `state`: The current parser state
- `str`: The string to consume

**Returns:** A new state with the string consumed and position updated

*Line 88*

---

## consumeWhile

**Type:** method

Creates a new state by consuming characters while a predicate is true.

**Parameters:**

- `state`: The current parser state
- `predicate`: Function that tests each character

**Returns:** A new state with matching characters consumed

*Line 109*

---

## unknown

**Type:** unknown

Creates a new state by consuming characters while a predicate is true.

**Parameters:**

- `state`: The current parser state
- `predicate`: Function that tests each character

**Returns:** A new state with matching characters consumed

*Line 109*

---

## peek

**Type:** method

Gets the next n characters from the input without consuming them.

**Parameters:**

- `state`: The current parser state
- `n`: Number of characters to peek (default: 1)

**Returns:** The next n characters as a string

*Line 127*

---

## unknown

**Type:** unknown

Gets the next n characters from the input without consuming them.

**Parameters:**

- `state`: The current parser state
- `n`: Number of characters to peek (default: 1)

**Returns:** The next n characters as a string

*Line 127*

---

## isAtEnd

**Type:** method

Checks if the parser has reached the end of input.

**Parameters:**

- `state`: The current parser state

**Returns:** True if at end of input, false otherwise

*Line 137*

---

## unknown

**Type:** unknown

Checks if the parser has reached the end of input.

**Parameters:**

- `state`: The current parser state

**Returns:** True if at end of input, false otherwise

*Line 137*

---

