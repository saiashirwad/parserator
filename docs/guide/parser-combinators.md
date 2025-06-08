# Parser Combinators

Parser combinators are functions that take one or more parsers and return a new parser. They allow you to build complex parsers from simple building blocks.

## Core Combinators

### Sequence Operations

#### `then` - Sequential Parsing
Runs parsers in sequence, keeping only the result of the second parser:

```typescript
import { string, char } from 'parserator'

const parser = string("hello").then(char(" ")).then(string("world"))
parser.parse("hello world") // Success: "world"
```

#### `zip` - Combine Results
Runs parsers in sequence and combines their results into a tuple:

```typescript
const parser = string("hello").zip(char(" ")).zip(string("world"))
parser.parse("hello world") // Success: ["hello", " ", "world"]
```

#### `sequence` - Multiple Parsers
Runs multiple parsers in sequence:

```typescript
import { sequence, string, char } from 'parserator'

const parser = sequence([
  string("hello"),
  char(" "),
  string("world")
])
parser.parse("hello world") // Success: ["hello", " ", "world"]
```

### Choice Operations

#### `or` - Try Alternatives
Tries parsers in order until one succeeds:

```typescript
import { or, string } from 'parserator'

const greeting = or(
  string("hello"),
  string("hi"),
  string("hey")
)
greeting.parse("hi there") // Success: "hi"
```

#### `optional` - Maybe Parse
Makes a parser optional, returning `undefined` if it fails:

```typescript
import { optional, string } from 'parserator'

const parser = string("hello").then(optional(string(" world")))
parser.parse("hello") // Success: undefined (for optional part)
```

### Repetition Combinators

#### `many0` - Zero or More
Parses zero or more occurrences:

```typescript
import { many0, digit } from 'parserator'

const digits = many0(digit)
digits.parse("123abc") // Success: ["1", "2", "3"]
digits.parse("abc")    // Success: []
```

#### `many1` - One or More
Parses one or more occurrences:

```typescript
import { many1, digit } from 'parserator'

const digits = many1(digit)
digits.parse("123abc") // Success: ["1", "2", "3"]
digits.parse("abc")    // Error: Expected at least one digit
```

#### `sepBy` - Separated Lists
Parses elements separated by a delimiter:

```typescript
import { sepBy, digit, char } from 'parserator'

const list = sepBy(digit, char(","))
list.parse("1,2,3") // Success: ["1", "2", "3"]
list.parse("")      // Success: []
```

#### `sepBy1` - Non-empty Separated Lists
Like `sepBy` but requires at least one element:

```typescript
import { sepBy1, digit, char } from 'parserator'

const list = sepBy1(digit, char(","))
list.parse("1,2,3") // Success: ["1", "2", "3"]
list.parse("")      // Error: Expected at least one element
```

### Lookahead and Boundaries

#### `lookahead` - Peek Without Consuming
Checks if a parser would succeed without consuming input:

```typescript
import { lookahead, string } from 'parserator'

const parser = lookahead(string("hello"))
const result = parser.parse("hello world")
// Success: "hello", but input position unchanged
```

#### `notFollowedBy` - Negative Lookahead
Succeeds only if the given parser would fail:

```typescript
import { notFollowedBy, char, alphabet } from 'parserator'

const identifier = many1(alphabet).thenDiscard(notFollowedBy(digit))
identifier.parse("abc123") // Error: identifier can't be followed by digit
```

#### `between` - Delimited Content
Parses content between two delimiters:

```typescript
import { between, char, many1, alphabet } from 'parserator'

const quoted = between(char('"'), char('"'), many1(alphabet))
quoted.parse('"hello"') // Success: ["h", "e", "l", "l", "o"]
```

### Transformation

#### `map` - Transform Results
Transforms the result of a successful parse:

```typescript
import { many1, digit } from 'parserator'

const number = many1(digit).map(digits => parseInt(digits.join("")))
number.parse("123") // Success: 123 (number, not string)
```

#### `mapError` - Transform Errors
Transforms error messages:

```typescript
const parser = string("hello").mapError(err => 
  "Custom error: " + err.message
)
```

## Building Complex Parsers

You can combine these combinators to build sophisticated parsers:

```typescript
import { parser, string, char, many1, alphabet, digit, or, optional } from 'parserator'

const identifier = many1(alphabet)
const number = many1(digit).map(digits => parseInt(digits.join("")))

const value = or(number, identifier)

const assignment = parser(function* () {
  const name = yield* identifier
  yield* char("=")
  const val = yield* value
  return { name: name.join(""), value: val }
})

assignment.parse("x=42")     // Success: { name: "x", value: 42 }
assignment.parse("name=abc") // Success: { name: "name", value: ["a","b","c"] }
```

## Next Steps

- Learn about [Error Handling](./error-handling.md)
- Explore [Advanced Patterns](./advanced-patterns.md)
- Check the [API Reference](/api/) for complete details
