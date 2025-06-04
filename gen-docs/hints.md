# hints

## levenshteinDistance

**Type:** function

Calculate the Levenshtein distance between two strings.This measures the minimum number of single-character edits (insertions, deletions, or substitutions)required to change one string into another.

**Parameters:**

- `a`: The first string
- `b`: The second string

**Returns:** The edit distance between the strings

*Line 14*

---

## unknown

**Type:** unknown

Calculate the Levenshtein distance between two strings.This measures the minimum number of single-character edits (insertions, deletions, or substitutions)required to change one string into another.

**Parameters:**

- `a`: The first string
- `b`: The second string

**Returns:** The edit distance between the strings

*Line 14*

---

## generateHints

**Type:** function

Generate helpful hints for a user's input based on a list of expected values.Uses edit distance to find the closest matches and suggests them as "Did you mean..." options.

**Parameters:**

- `found`: The string the user actually typed
- `expected`: Array of valid/expected strings
- `maxDistance`: Maximum edit distance to consider (default: 2)
- `maxHints`: Maximum number of hints to return (default: 3)

**Returns:** Array of suggested strings, sorted by edit distance

*Line 48*

---

## unknown

**Type:** unknown

Generate helpful hints for a user's input based on a list of expected values.Uses edit distance to find the closest matches and suggests them as "Did you mean..." options.

**Parameters:**

- `found`: The string the user actually typed
- `expected`: Array of valid/expected strings
- `maxDistance`: Maximum edit distance to consider (default: 2)
- `maxHints`: Maximum number of hints to return (default: 3)

**Returns:** Array of suggested strings, sorted by edit distance

*Line 48*

---

## keywordWithHints

**Type:** variable

Enhanced keyword parser that provides intelligent hints when the user types something similar.

**Parameters:**

- `keywords`: Array of valid keywords to match against

**Returns:** A function that creates a parser for a specific keyword with hint generation

**Examples:**

```typescript
const schemeKeywords = ["lambda", "let", "if", "cond", "define", "quote"]
const lambdaParser = keywordWithHints(schemeKeywords)("lambda")

// Parsing "lamdba" will suggest "lambda" as a hint
const result = lambdaParser.parse("lamdba")
```

*Line 84*

---

## unknown

**Type:** unknown

Enhanced keyword parser that provides intelligent hints when the user types something similar.

**Parameters:**

- `keywords`: Array of valid keywords to match against

**Returns:** A function that creates a parser for a specific keyword with hint generation

**Examples:**

```typescript
const schemeKeywords = ["lambda", "let", "if", "cond", "define", "quote"]
const lambdaParser = keywordWithHints(schemeKeywords)("lambda")

// Parsing "lamdba" will suggest "lambda" as a hint
const result = lambdaParser.parse("lamdba")
```

*Line 84*

---

## anyKeywordWithHints

**Type:** function

Creates a parser that matches any of the provided keywords with hint generation.

**Parameters:**

- `keywords`: Array of valid keywords

**Returns:** A parser that matches any keyword and provides hints for typos

**Examples:**

```typescript
const jsKeywords = ["function", "const", "let", "var", "class", "if", "else"]
const keywordParser = anyKeywordWithHints(jsKeywords)

// Parsing "functoin" will suggest "function"
const result = keywordParser.parse("functoin")
```

*Line 122*

---

## unknown

**Type:** unknown

Creates a parser that matches any of the provided keywords with hint generation.

**Parameters:**

- `keywords`: Array of valid keywords

**Returns:** A parser that matches any keyword and provides hints for typos

**Examples:**

```typescript
const jsKeywords = ["function", "const", "let", "var", "class", "if", "else"]
const keywordParser = anyKeywordWithHints(jsKeywords)

// Parsing "functoin" will suggest "function"
const result = keywordParser.parse("functoin")
```

*Line 122*

---

## stringWithHints

**Type:** function

Creates a parser for string literals with hint generation for common mistakes.

**Parameters:**

- `validStrings`: Array of valid string values

**Returns:** A parser that matches quoted strings and provides hints for typos

**Examples:**

```typescript
const colorParser = stringWithHints(["red", "green", "blue", "yellow"])

// Parsing '"gren"' will suggest "green"
const result = colorParser.parse('"gren"')
```

*Line 163*

---

## unknown

**Type:** unknown

Creates a parser for string literals with hint generation for common mistakes.

**Parameters:**

- `validStrings`: Array of valid string values

**Returns:** A parser that matches quoted strings and provides hints for typos

**Examples:**

```typescript
const colorParser = stringWithHints(["red", "green", "blue", "yellow"])

// Parsing '"gren"' will suggest "green"
const result = colorParser.parse('"gren"')
```

*Line 163*

---

