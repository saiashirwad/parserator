# INI Parser

In this example, we'll build a complete parser for the INI configuration format. This demonstrates how to handle whitespace, comments, and structured data using Parserator's generator syntax and error handling features.

## INI File Format

The INI format consists of:

- **Sections**: Denoted by `[section-name]`
- **Properties**: Key-value pairs like `key = value`
- **Comments**: Lines starting with `;` or `#`
- **Whitespace**: Flexible spacing between tokens and blank lines

## Whitespace and Comments

First, we define how to handle non-significant content like spaces, tabs, and comments.

```typescript
import {
  regex,
  or,
  string,
  skipMany0,
  Parser,
  parser,
  char,
  commit,
  atomic,
  many,
  optional,
  eof
} from "parserator";

const whitespace = regex(/[ \t]+/).label("whitespace");
const lineBreak = or(string("\r\n"), string("\n"), string("\r")).label(
  "line break"
);
const blankLine = regex(/[ \t]*[\r\n]/).label("blank line");
const comment = regex(/[;#][^\n\r]*/).label("comment");

// Combines whitespace and comments
const space = or(whitespace, comment);

// Helper to skip multiple spaces/comments
const spaces = skipMany0(space);

// Helper to skip spaces, comments, and newlines
const spacesNewlines = skipMany0(or(space, lineBreak, blankLine));

/**
 * Token helper: trims leading whitespace/comments from a parser
 */
function token<T>(p: Parser<T>): Parser<T> {
  return p.trimLeft(spaces);
}
```

## Properties: key = value

Properties are the core data units. We use `atomic()` to ensure that if we match a key but fail later (e.g., missing `=`), we don't partially consume the input, allowing other parsers to try.

We use `commit()` after matching the `=` sign. This tells Parserator: "We have definitely identified this as a property; if it fails now, don't backtrack—report an error here."

```typescript
const key = token(regex(/[a-zA-Z0-9_\-\.]+/).label("property key"));

const value = regex(/[^\r\n]*/)
  .map(s => s.trim())
  .label("property value");

const property = atomic(
  parser(function* () {
    const k = yield* key;
    yield* token(char("="));

    // After the '=', this MUST be a valid property
    yield* commit();

    const v = yield* value.expect("property value after '='");
    return { key: k, value: v };
  })
);
```

## Sections: [section-name]

Sections contain a header and a list of properties. Again, we use `commit()` after the opening `[` to improve error messages (e.g., "Expected section name" instead of "Expected section or property").

```typescript
interface IniSection {
  type: "section";
  name: string;
  properties: Array<{ key: string; value: string }>;
}

const section: Parser<IniSection> = atomic(
  parser(function* () {
    yield* spacesNewlines;
    yield* token(char("["));

    // Identified as a section header
    yield* commit();

    const name = yield* regex(/[^\]]+/)
      .map(s => s.trim())
      .expect("section name");

    yield* char("]").expect("closing bracket ']'");
    yield* optional(lineBreak);

    const properties = yield* many(
      parser(function* () {
        yield* spaces;
        const prop = yield* property;
        yield* optional(lineBreak);
        yield* spacesNewlines;
        return prop;
      })
    );

    return {
      type: "section",
      name,
      properties
    };
  })
);
```

## Complete Parser

Finally, we combine everything into a top-level `iniFile` parser.

```typescript
const iniFile = parser(function* () {
  yield* spacesNewlines;
  const sections = yield* many(section);
  yield* spacesNewlines;
  yield* eof.expect("end of input");
  return sections;
});
```

## Usage Example

```typescript
const config = `
[database]
host = localhost
port = 5432
; Use admin for production
user = admin

[cache]
enabled = true
# Internal TTL
ttl = 3600
`;

try {
  const result = iniFile.parseOrThrow(config);
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error("Parse failed!");
  // Parserator provides rich error snippets automatically
  console.error(err.message);
}
```

## Output Structure

The parser returns a structured array of sections:

```json
[
  {
    "type": "section",
    "name": "database",
    "properties": [
      { "key": "host", "value": "localhost" },
      { "key": "port", "value": "5432" },
      { "key": "user", "value": "admin" }
    ]
  },
  {
    "type": "section",
    "name": "cache",
    "properties": [
      { "key": "enabled", "value": "true" },
      { "key": "ttl", "value": "3600" }
    ]
  }
]
```
