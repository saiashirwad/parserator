# Error Formatter

The `ErrorFormatter` class transforms `ParseErrorBundle` objects into human-readable error messages. It supports multiple output formats including plain text, ANSI-colored terminal output, HTML, and JSON.

## Class: ErrorFormatter

```typescript
class ErrorFormatter {
  constructor(
    format: "plain" | "ansi" | "html" | "json" = "plain",
    options?: ErrorFormatterOptions
  );

  /** Formats the error bundle into a string based on the configured format */
  format(bundle: ParseErrorBundle): string;

  /** Returns a new formatter instance with updated options */
  withOptions(options: Partial<ErrorFormatterOptions>): ErrorFormatter;

  /** Returns a new formatter instance with a different format */
  withFormat(format: ErrorFormat): ErrorFormatter;
}
```

### ErrorFormatterOptions

| Option            | Type      | Default | Description                                           |
| :---------------- | :-------- | :------ | :---------------------------------------------------- |
| `maxContextLines` | `number`  | `3`     | Number of source code lines to show around the error. |
| `showHints`       | `boolean` | `true`  | Whether to include typo suggestions or hints.         |
| `colorize`        | `boolean` | `true`  | Enable/disable color output (for ANSI format).        |
| `showContext`     | `boolean` | `true`  | Show source code snippets and labels.                 |
| `tabSize`         | `number`  | `2`     | Indentation size for JSON output.                     |

## Format Types

### `plain`

Standard text output without any formatting or colors. Ideal for logs or basic CLI tools.

### `ansi`

Terminal-friendly output using ANSI escape codes for syntax highlighting and emphasizing error locations.

### `html`

Structured HTML markup with CSS classes (`parse-error`, `error-header`, `context-line`, etc.) for embedding errors in web interfaces.

### `json`

Machine-readable JSON object containing detailed error information, location data, and context for programmatic processing.

## Convenience Functions

The `formatError` object provides quick access to formatting without manually instantiating the class.

```typescript
const formatError = {
  plain(bundle: ParseErrorBundle, options?: ErrorFormatterOptions): string,
  ansi(bundle: ParseErrorBundle, options?: ErrorFormatterOptions): string,
  html(bundle: ParseErrorBundle, options?: ErrorFormatterOptions): string,
  json(bundle: ParseErrorBundle, options?: ErrorFormatterOptions): string
};
```

## Examples

### Plain Text

```text
Error at line 1, column 5:
  >   1 | { "a" 1 }
            ^
  Expected: : or , found 1
```

### ANSI (Terminal)

```ansi
Error at line 1, column 5:
  >   1 | { "a" 1 }
            ^
  Expected: : or , found 1
  Did you mean: :?
```

### HTML

```html
<div class="parse-error">
  <div class="error-header">Error at line 1, column 5:</div>
  <div class="error-context">
    <div class="context-line">> 1 | { &quot;a&quot; 1 }</div>
    <div class="error-pointer">^</div>
  </div>
  <div class="error-message">Expected: : or , found 1</div>
</div>
```

### JSON

```json
{
  "error": {
    "type": "Expected",
    "message": "Expected: : or , found 1",
    "location": {
      "line": 1,
      "column": 5,
      "offset": 4,
      "length": 1
    },
    "context": {
      "lines": [">   1 | { \"a\" 1 }"],
      "stack": ["object"]
    },
    "hints": [":"],
    "source": "{ \"a\" 1 }"
  }
}
```
