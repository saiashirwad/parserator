# Error-formatter

## ErrorFormatter

Formats ParseErrorBundle into human-readable error messages with multiple output formats. Supports plain text, ANSI colors, HTML, and JSON formats.

## Functions

### format

```typescript
format(bundle: ParseErrorBundle): string
```

Format a ParseErrorBundle into a string based on the configured format.

**Parameters:**

- `bundle` (`ParseErrorBundle`) - The error bundle to format

**Returns:** `string` - Formatted error message string

### withOptions

```typescript
withOptions(options: Partial<ErrorFormatterOptions>): ErrorFormatter
```

Create a new formatter with different options.

**Parameters:**

- `options` (`Partial<ErrorFormatterOptions>`)

**Returns:** `ErrorFormatter`

### withFormat

```typescript
withFormat(format: ErrorFormat): ErrorFormatter
```

Create a new formatter with a different format.

**Parameters:**

- `format` (`ErrorFormat`)

**Returns:** `ErrorFormatter`

### formatError

```typescript
export const formatError = {
  plain: (bundle: ParseErrorBundle, options?: ErrorFormatterOptions) => ...
```

Convenience functions for quick formatting.

**Parameters:**

- `bundle` (`ParseErrorBundle`)
- `options?` (`ErrorFormatterOptions`)

