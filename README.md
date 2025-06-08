# Parserator

An elegant parser combinators library for TypeScript that makes building parsers as simple as combining LEGO blocks.

## What are Parser Combinators?

Think of parser combinators as small, reusable parsing functions that you can combine to build complex parsers. Instead of writing one giant parsing function, you build many small ones and compose them together.

```typescript
// Instead of this mess:
function parsePhoneNumber(input: string) {
  // 20 lines of regex and string validation...
}

// You write this:
const phoneNumber = parser(function* () {
  yield* char("(");
  const areaCode = yield* many1(digit).expect("area code");
  yield* char(")");
  yield* char(" ");
  const exchange = yield* many1(digit).expect("exchange");
  yield* char("-");
  const number = yield* many1(digit).expect("number");

  return `(${areaCode.join("")}) ${exchange.join("")}-${number.join("")}`;
});

phoneNumber.parseOrThrow("(555) 123-4567"); // → "(555) 123-4567"
```

## Quick Start

```bash
npm install parserator
# or
bun add parserator
```

```typescript
import { Parser, char, string, many1, digit, parser } from "parserator";

// Parse a simple number
const number = many1(digit).map(digits => parseInt(digits.join("")));
number.parseOrThrow("123"); // → 123

// Parse coordinates like "(10, 20)"
const coordinate = parser(function* () {
  yield* char("(").expect("opening parenthesis '('");
  const x = yield* number;
  yield* string(", ").expect("comma between coordinates");
  const y = yield* number;
  yield* char(")").expect("closing parenthesis ')'");
  return { x, y };
});

coordinate.parseOrThrow("(10, 20)"); // → { x: 10, y: 20 }
```

## Building Blocks

Parserator provides simple building blocks that you combine to parse complex formats:

### Basic Parsers

```typescript
import { char, string, digit, alphabet, regex } from "parserator";

char("a"); // Matches single character 'a'
string("hello"); // Matches exact string "hello"
digit; // Matches any digit 0-9
alphabet; // Matches any letter a-z, A-Z
regex(/[a-z]+/); // Matches using regular expressions
```

### Combinators

```typescript
import { many, many1, optional, or, sepBy } from "parserator";

many(digit); // Zero or more digits
many1(alphabet); // One or more letters
optional(char("-")); // Optional minus sign
or(string("yes"), string("no")); // Either "yes" or "no"
sepBy(digit, char(",")); // Digits separated by commas: "1,2,3"
```

### Sequencing

```typescript
// Traditional method chaining
const parser1 = string("Hello").then(char(" ")).then(string("World"));

// Generator syntax (recommended for complex parsers)
const parser2 = parser(function* () {
  yield* string("Hello");
  yield* char(" ");
  yield* string("World");
  return "Greeting parsed!";
});
```

## Generator Syntax

The generator syntax (`parser`) makes complex parsers readable and maintainable:

```typescript
const jsonObject = parser(function* () {
  yield* char("{");
  yield* whitespace;

  const properties = yield* sepBy(
    parser(function* () {
      const key = yield* stringLiteral;
      yield* char(":");
      yield* whitespace;
      const value = yield* jsonValue;
      return { key, value };
    }),
    char(",")
  );

  yield* whitespace;
  yield* char("}");
  return Object.fromEntries(properties.map(p => [p.key, p.value]));
});
```

## Real-World Example: INI File Parser

```typescript
import {
  Parser,
  parser,
  char,
  regex,
  many,
  optional,
  or,
  string,
  atomic,
  commit,
  skipMany0
} from "parserator";

// Handle whitespace and comments
const whitespace = regex(/[ \t]+/);
const comment = regex(/[;#][^\n\r]*/);
const space = or(whitespace, comment);
const spaces = skipMany0(space);

function token<T>(parser: Parser<T>): Parser<T> {
  return parser.trimLeft(spaces);
}

// Parse INI sections like [database]
const section = atomic(
  parser(function* () {
    yield* spaces;
    yield* token(char("["));
    yield* commit(); // Better error messages after this point

    const name = yield* regex(/[^\]]+/)
      .map(s => s.trim())
      .expect("section name");

    yield* char("]").expect("closing bracket ']'");

    const properties = yield* many(
      parser(function* () {
        const key = yield* token(regex(/[a-zA-Z0-9_\-\.]+/));
        yield* token(char("="));
        yield* commit();
        const value = yield* regex(/[^\r\n]*/).map(s => s.trim());
        return { key, value };
      })
    );

    return { type: "section", name, properties };
  })
);

const iniFile = parser(function* () {
  yield* spaces;
  const sections = yield* many(section);
  yield* eof;
  return sections;
});

// Usage
const config = iniFile.parseOrThrow(`
[database]
host = localhost
port = 5432

[cache]
enabled = true
`);
```

## Error Handling

Parserator provides excellent error messages with precise locations:

```typescript
const parser = parser(function* () {
  yield* string("function");
  yield* commit(); // Commits to this parsing path
  yield* char("(").expect("opening parenthesis after 'function'");
  // ... rest of function parser
});

// Input: "function {"
// Error: Expected opening parenthesis after 'function' at line 1, column 9
```

### Error Recovery

```typescript
import { Either, ErrorFormatter } from "parserator";

const result = parser.parse(input);

if (Either.isLeft(result.result)) {
  const formatter = new ErrorFormatter("ansi"); // or "html"
  console.error(formatter.format(result.result.left));
} else {
  console.log("Parsed:", result.result.right);
}
```

## Advanced Features

### Atomic Parsing

Prevents partial consumption on failure:

```typescript
const complexExpression = parser(function* () {
  yield* identifier;
  yield* char("(");
  yield* many(expression);
  yield* char(")");
}).atomic(); // All-or-nothing parsing
```

### Lookahead

Peek without consuming input:

```typescript
const nextIsOperator = lookahead(or(string("++"), string("--"), string("+=")));
```

### Custom Transformations

```typescript
const hexColor = regex(/#[0-9a-fA-F]{6}/).map(hex => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16)
}));

hexColor.parseOrThrow("#ff6b35");
// → { r: 255, g: 107, b: 53 }
```

## Why Parser Combinators?

- **Composable**: Small parsers combine into larger ones
- **Type-Safe**: Full TypeScript support with precise types
- **Readable**: Code reads like the grammar you're parsing
- **Testable**: Each parser can be tested independently
- **Maintainable**: Easy to modify and extend grammars

## API Reference

### Core Classes

- `Parser<T>` - The main parser class
- `ParseErrorBundle` - Contains parsing errors with locations
- `ErrorFormatter` - Formats errors for display

### Basic Parsers

- `char(c)` - Match single character
- `string(s)` - Match exact string
- `regex(r)` - Match regular expression
- `digit`, `alphabet` - Built-in character classes

### Combinators

- `many(p)`, `many1(p)` - Repetition
- `optional(p)` - Optional parsing
- `or(...parsers)` - Alternatives
- `sepBy(p, sep)` - Separated lists
- `between(open, close, p)` - Delimited content

### Generator Utilities

- `parser(fn)` - Generator-based parsing
- `commit()` - Prevent backtracking
- `atomic(p)` - All-or-nothing parsing

## Examples

Check out the `/examples` directory for complete parsers:

- `ini-parser.ts` - Configuration file parser
- `js-parser.ts` - Simplified JavaScript parser

## License

MIT
