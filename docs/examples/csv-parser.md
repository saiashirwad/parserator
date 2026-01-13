# CSV Parser

This guide demonstrates how to build a robust CSV parser using Parserator. We will handle unquoted fields, quoted fields with commas, and escaped quotes (using `""` for a literal `"`).

## Overview

A CSV file consists of rows separated by newlines, and each row consists of fields separated by commas. Fields can be "simple" (unquoted) or "quoted" if they contain special characters like commas or newlines.

## Basic Structure

We'll start by importing the necessary combinators from `parserator`.

```typescript
import {
  parser,
  char,
  string,
  or,
  many,
  many1,
  sepBy,
  notChar,
  between,
  eof
} from "parserator";
```

## Unquoted Fields

An unquoted field is a sequence of characters that are not commas, quotes, or newlines. We use `notChar` to match any character except these delimiters.

```typescript
// Unquoted field (no commas, no quotes, no newlines)
const unquotedField = many(notChar(',"\n\r')).map(chars =>
  chars.join("").trim()
);
```

## Quoted Fields

Quoted fields start and end with a double quote `"`. Inside, they can contain commas and even newlines. However, literal double quotes must be escaped by doubling them (`""`).

### Escaped Quotes

We first define how to handle the `""` escape sequence.

```typescript
// Escaped quote: "" becomes "
const escapedQuote = string('""').map(() => '"');
```

### Quoted Content

The content of a quoted field consists of either an escaped quote or any character that isn't a double quote.

```typescript
// Quoted field content
const quotedContent = many(or(escapedQuote, notChar('"')));

// Quoted field
const quotedField = between(char('"'), char('"'), quotedContent).map(chars =>
  chars.join("")
);
```

## Complete Parser

Now we can combine these pieces into a full CSV parser. We define a `field` as either a `quotedField` or an `unquotedField`, a `row` as a list of fields separated by commas, and the `csv` parser as rows separated by newlines.

```typescript
// Field (quoted or unquoted)
const field = or(quotedField, unquotedField);

// Row
const row = sepBy(field, char(","));

// CSV file
const csv = parser(function* () {
  const rows = yield* sepBy(row, or(string("\r\n"), char("\n")));
  yield* eof;
  return rows;
});
```

## Usage Examples

You can now use this parser to handle various CSV formats.

```typescript
const data = `Name,Occupation,Location
"Doe, John",Software Engineer,New York
"Jane ""The Brain"" Smith",Data Scientist,San Francisco
Bob,Manager,"Chicago, IL"`;

const result = csv.parseOrThrow(data);

console.log(result);
/*
[
  ["Name", "Occupation", "Location"],
  ["Doe, John", "Software Engineer", "New York"],
  ["Jane \"The Brain\" Smith", "Data Scientist", "San Francisco"],
  ["Bob", "Manager", "Chicago, IL"]
]
*/
```

## Error Cases

Parserator provides helpful error messages if the CSV is malformed.

```typescript
try {
  // Missing closing quote
  csv.parseOrThrow('Name,City\n"John,New York');
} catch (e) {
  console.error(e.message);
  /*
  Expected " but reached end of input
  at line 2, column 15:
  2 | "John,New York
                   ^
  */
}
```
