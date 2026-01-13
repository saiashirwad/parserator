# Hints

API for providing intelligent typo suggestions and distance-based matching.

## levenshteinDistance

```typescript
function levenshteinDistance(a: string, b: string): number;
```

Calculates the edit distance between two strings using the Levenshtein algorithm. This measures the minimum number of single-character edits (insertions, deletions, or substitutions) required to transform one string into another.

## generateHints

```typescript
function generateHints(
  found: string,
  expected: string[],
  maxDistance: number = 2,
  maxHints: number = 3
): string[];
```

Generates helpful "Did you mean..." suggestions by finding the closest matches from a list of expected values.

- **found**: The actual input string
- **expected**: List of valid/allowed strings
- **maxDistance**: Maximum edit distance to consider (default: 2)
- **maxHints**: Maximum number of suggestions to return (default: 3)

## keywordWithHints

```typescript
function keywordWithHints(keywords: string[]): (keyword: string) => Parser<string>;
```

Creates a factory for keyword parsers that provide hints when an unknown but similar identifier is encountered.

```typescript
const keywords = ["select", "from", "where"];
const select = keywordWithHints(keywords)("select");

// Parsing "selct" will throw an error suggesting "select"
```

## anyKeywordWithHints

```typescript
function anyKeywordWithHints(keywords: string[]): Parser<string>;
```

A parser that matches any keyword from the provided list. If no exact match is found, it attempts to extract an identifier and provides hints from the keyword list.

```typescript
const op = anyKeywordWithHints(["add", "sub", "mul", "div"]);
```

## stringWithHints

```typescript
function stringWithHints(validStrings: string[]): Parser<string>;
```

Parses a quoted string literal and validates its content against a list of allowed values. Provides hints if the quoted content is similar to one of the valid strings.

```typescript
const color = stringWithHints(["red", "green", "blue"]);
// Matches "red", "green", "blue"
// On "gren", suggests "green"
```

## Examples

### Typo Correction in Action

```typescript
import { anyKeywordWithHints, errorFormatter } from "parserator";

const parser = anyKeywordWithHints(["function", "const", "class"]);

try {
  parser.parseOrThrow("functoin");
} catch (e) {
  const formatted = errorFormatter.formatAnsi(e, "functoin");
  console.log(formatted);
  /*
  Unexpected "functoin" at 1:1
  1 | functoin
    | ^^^^^^^^
  Did you mean: function?
  */
}
```
