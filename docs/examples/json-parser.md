# JSON Parser

This tutorial demonstrates how to build a complete, specification-compliant JSON parser using **Parserator**. We will use a mix of built-in combinators and the powerful generator syntax to handle nested structures, escape sequences, and recursive grammars.

## 1. Overview

JSON consists of six basic data types:

- **Primitives**: `null`, `boolean`, `number`, `string`
- **Structures**: `array` (ordered list), `object` (key-value pairs)

Our parser will handle whitespace automatically between tokens and provide clear error messages for invalid inputs.

## 2. Whitespace & Tokens

In JSON, whitespace is allowed before and after any structural token (like `{`, `}`, `[`, `]`, `:`, `,`). We'll create a `token` helper to handle this.

```typescript
import {
  parser,
  char,
  string,
  regex,
  or,
  many,
  sepBy,
  between,
  Parser
} from "parserator";

const whitespace = regex(/\s*/);

/**
 * Consumes whitespace before a parser and returns its result.
 */
function token<T>(p: Parser<T>): Parser<T> {
  return p.trimLeft(whitespace);
}
```

## 3. Primitives

We start by defining the simplest components. These are mostly direct mappings of strings to their JavaScript counterparts.

```typescript
const jsonNull = string("null").map(() => null);
const jsonTrue = string("true").map(() => true);
const jsonFalse = string("false").map(() => false);
const jsonBool = or(jsonTrue, jsonFalse);

// Match standard JSON numbers including scientific notation
const jsonNumber = regex(/-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/).map(
  Number
);
```

### String Parsing

Strings are the most complex primitive because they require handling escape sequences like `\n` or `\uXXXX`.

```typescript
const jsonString = parser(function* () {
  yield* char('"');
  const chars: string[] = [];

  while (true) {
    const next = yield* or(
      string('\\"').map(() => '"'),
      string("\\\\").map(() => "\\"),
      string("\\/").map(() => "/"),
      string("\\b").map(() => "\b"),
      string("\\f").map(() => "\f"),
      string("\\n").map(() => "\n"),
      string("\\r").map(() => "\r"),
      string("\\t").map(() => "\t"),
      regex(/\\u[0-9a-fA-F]{4}/).map(s =>
        String.fromCharCode(parseInt(s.slice(2), 16))
      ),
      regex(/[^"\\]+/), // Match any character except " or \
      char('"').map(() => null) // Closing quote
    );

    if (next === null) break;
    chars.push(next);
  }

  return chars.join("");
});
```

## 4. Recursive Structures

Since JSON values can contain other JSON values (nested objects/arrays), we use `Parser.lazy` to handle circular references.

```typescript
// Define the entry point for any JSON value
const jsonValue: Parser<any> = Parser.lazy(() =>
  or(jsonNull, jsonBool, jsonNumber, jsonString, jsonArray, jsonObject)
);

// Arrays: [ value, value, ... ]
const jsonArray: Parser<any[]> = between(
  token(char("[")),
  token(char("]")),
  sepBy(token(jsonValue), token(char(",")))
);

// Objects: { "key": value, ... }
const jsonObject: Parser<Record<string, any>> = parser(function* () {
  yield* token(char("{"));

  const pairs = yield* sepBy(
    parser(function* () {
      const key = yield* token(jsonString);
      yield* token(char(":"));
      const value = yield* token(jsonValue);
      return [key, value] as const;
    }),
    token(char(","))
  );

  yield* token(char("}"));
  return Object.fromEntries(pairs);
});

// Final Export
export const json = token(jsonValue);
```

## 5. Usage Examples

You can now use the `json` parser to turn strings into JavaScript objects.

```typescript
const data = `{
  "name": "parserator",
  "version": "1.0.0",
  "features": ["monadic", "type-safe"],
  "active": true,
  "config": null
}`;

const result = json.parseOrThrow(data);
console.log(result.name); // "parserator"
```

### Testing different types

```typescript
json.parseOrThrow("true"); // true
json.parseOrThrow("null"); // null
json.parseOrThrow("-1.23e+4"); // -12300
json.parseOrThrow("[1, 2, 3]"); // [1, 2, 3]
json.parseOrThrow('{"a": 1}'); // { a: 1 }
```

## 6. Error Handling

One of the main advantages of Parserator is clear error reporting. If you provide invalid JSON, you'll get a descriptive error.

```typescript
try {
  json.parseOrThrow('{"key": [1, 2, 3 }');
} catch (e) {
  // ParseError: Expected ',' or ']' at line 1, column 18
  // {"key": [1, 2, 3 }
  //                  ^
}
```
