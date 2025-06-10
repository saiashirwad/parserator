# Hints

## Functions

### levenshteinDistance

```typescript
export function levenshteinDistance(a: string, b: string): number;
```

Calculate the Levenshtein distance between two strings. This measures the minimum number of single-character edits (insertions, deletions, or substitutions) required to change one string into another.

**Parameters:**

- `a` (`string`) - The first string
- `b` (`string`) - The second string

**Returns:** `number` - The edit distance between the strings

### generateHints

```typescript
export function generateHints(
  found: string,
  expected: string[],
  maxDistance: number = 2,
  maxHints: number = 3
): string[];
```

Generate helpful hints for a user's input based on a list of expected values. Uses edit distance to find the closest matches and suggests them as "Did you mean..." options.

**Parameters:**

- `found` (`string`) - The string the user actually typed
- `expected` (`string[]`) - Array of valid/expected strings
- `maxDistance?` (`number`) - Maximum edit distance to consider (default: 2)
- `maxHints?` (`number`) - Maximum number of hints to return (default: 3)

**Returns:** `string[]` - Array of suggested strings, sorted by edit distance

### keywordWithHints

```typescript
export const keywordWithHints = (keywords: string[])
```

Enhanced keyword parser that provides intelligent hints when the user types something similar.

**Parameters:**

- `keywords` (`string[]`) - Array of valid keywords to match against

**Examples:**

```typescript
const schemeKeywords = ["lambda", "let", "if", "cond", "define", "quote"];
const lambdaParser = keywordWithHints(schemeKeywords)("lambda");

// Parsing "lamdba" will suggest "lambda" as a hint
const result = lambdaParser.parse("lamdba");
```

### anyKeywordWithHints

```typescript
export function anyKeywordWithHints(keywords: string[]): Parser<string>;
```

Creates a parser that matches any of the provided keywords with hint generation.

**Parameters:**

- `keywords` (`string[]`) - Array of valid keywords

**Returns:** `Parser<string>` - A parser that matches any keyword and provides hints for typos

**Examples:**

```typescript
const jsKeywords = ["function", "const", "let", "var", "class", "if", "else"];
const keywordParser = anyKeywordWithHints(jsKeywords);

// Parsing "functoin" will suggest "function"
const result = keywordParser.parse("functoin");
```

### stringWithHints

```typescript
export function stringWithHints(validStrings: string[]): Parser<string>;
```

Creates a parser for string literals with hint generation for common mistakes.

**Parameters:**

- `validStrings` (`string[]`) - Array of valid string values

**Returns:** `Parser<string>` - A parser that matches quoted strings and provides hints for typos

**Examples:**

```typescript
const colorParser = stringWithHints(["red", "green", "blue", "yellow"]);

// Parsing '"gren"' will suggest "green"
const result = colorParser.parse('"gren"');
```
