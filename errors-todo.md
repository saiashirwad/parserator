# Error System Refactoring TODO - Enhanced Option 1

This document outlines the tasks needed to enhance the current 4-type error system while maintaining backward compatibility.

## Current State Analysis

### Files Involved
- `src/state.ts` - Parser state and context management
- `src/errors.ts` - Error types and ParseErrorBundle 
- `src/error-formatter.ts` - Rich error formatting with multiple output formats
- `src/parser.ts` - Parser class with error creation methods

### Current Error Types (Keeping All 4)
- `ExpectedParseErr` - When specific tokens/patterns were expected
- `UnexpectedParseErr` - When unexpected input was found  
- `CustomParseErr` - Custom error messages with optional hints
- `FatalParseErr` - Fatal errors that prevent backtracking

### Current API Methods
- `Parser.error(message)` - Creates Custom error
- `Parser.fatal(message)` - Creates Fatal error  
- `Parser.fail({ message, expected, found })` - Creates Custom error
- `parser.expect("description")` - Creates Expected error on failure
- `parser.withError(() => "message")` - Converts any error to Custom
- `parser.label("name")` - Adds to context stack

## Enhancement Tasks

### Phase 1: Clean Up Current Error Types

#### Task 1.1: Standardize Error Type Properties
- [x] **File**: `src/errors.ts`
- [x] **Action**: Ensure all error types have consistent properties:
  ```ts
  type ExpectedParseErr = {
    tag: "Expected";
    span: Span;
    items: string[];
    context: string[];
    found?: string;  // ADD: What was actually found
  };
  
  type UnexpectedParseErr = {
    tag: "Unexpected";
    span: Span;
    found: string;
    context: string[];
    hints?: string[];
  };
  
  type CustomParseErr = {
    tag: "Custom";
    span: Span;
    message: string;
    hints?: string[];
    context: string[];
  };
  
  type FatalParseErr = {
    tag: "Fatal";
    span: Span;
    message: string;
    context: string[];
  };
  ```

#### Task 1.2: Update ParseErrorBundle
- [x] **File**: `src/errors.ts`
- [x] **Action**: Add simple toString() method for basic formatting:
  ```ts
  toString(): string {
    const err = this.primary;
    switch (err.tag) {
      case "Expected":
        return `Expected ${err.items.join(" or ")}${err.found ? `, found ${err.found}` : ""}`;
      case "Unexpected":
        return `Unexpected ${err.found}`;
      case "Custom":
        return err.message;
      case "Fatal":
        return `Fatal: ${err.message}`;
    }
  }
  ```

#### Task 1.3: Add Optional Rich Formatting
- [x] **File**: `src/errors.ts`
- [x] **Action**: Add format() method that uses ErrorFormatter when needed:
  ```ts
  format(format: "plain" | "ansi" | "html" | "json" = "plain"): string {
    return new ErrorFormatter(format).format(this);
  }
  ```

### Phase 2: Add New Error Creation Methods (No Breaking Changes)

#### Task 2.1: Add Specific Error Creator Methods
- [x] **File**: `src/parser.ts`
- [x] **Action**: Add new methods while keeping existing ones:
  ```ts
  // NEW: Specific error creators
  static expected<Ctx = {}>(items: string[], found?: string): Parser<never, Ctx> {
    return new Parser(state => {
      const error: ParseErr = {
        tag: "Expected",
        span: createSpan(state),
        items,
        found,
        context: state.context?.labelStack ?? []
      };
      return Parser.failRich({ errors: [error] }, state);
    });
  }

  static unexpected<Ctx = {}>(found: string, hints?: string[]): Parser<never, Ctx> {
    return new Parser(state => {
      const error: ParseErr = {
        tag: "Unexpected", 
        span: createSpan(state),
        found,
        hints,
        context: state.context?.labelStack ?? []
      };
      return Parser.failRich({ errors: [error] }, state);
    });
  }
  ```

#### Task 2.2: Enhance Existing Methods
- [x] **File**: `src/parser.ts`
- [x] **Action**: Add optional hints parameter to existing methods:
  ```ts
  // ENHANCED: Add hints to existing error method
  static error<Ctx = {}>(
    message: string,
    hints?: string[],
    stateCallback?: (state: ParserState<Ctx>) => ParserState<Ctx>
  ): Parser<never, Ctx> {
    return new Parser(state => {
      const error: ParseErr = {
        tag: "Custom",
        span: createSpan(state),
        message,
        hints,
        context: state.context?.labelStack ?? []
      };
      return Parser.failRich({ errors: [error] }, state);
    });
  }
  ```

#### Task 2.3: Enhanced Unified Fail Method
- [x] **File**: `src/parser.ts`
- [x] **Action**: Create powerful unified fail method for complex cases:
  ```ts
  static failWith<Ctx = {}>(options: {
    type: "expected" | "unexpected" | "custom" | "fatal";
    message?: string;
    items?: string[];
    found?: string; 
    hints?: string[];
  }): Parser<never, Ctx> {
    return new Parser(state => {
      const span = createSpan(state);
      const context = state.context?.labelStack ?? [];
      
      let error: ParseErr;
      switch (options.type) {
        case "expected":
          error = {
            tag: "Expected",
            span,
            items: options.items ?? [],
            found: options.found,
            context
          };
          break;
        case "unexpected":
          error = {
            tag: "Unexpected", 
            span,
            found: options.found ?? "",
            hints: options.hints,
            context
          };
          break;
        case "custom":
          error = {
            tag: "Custom",
            span, 
            message: options.message ?? "",
            hints: options.hints,
            context
          };
          break;
        case "fatal":
          error = {
            tag: "Fatal",
            span,
            message: options.message ?? "",
            context
          };
          break;
      }
      
      return Parser.failRich({ errors: [error] }, state);
    });
  }
  ```

### Phase 3: Update Error Formatter

#### Task 3.1: Update ErrorFormatter for Enhanced Types
- [x] **File**: `src/error-formatter.ts`
- [x] **Action**: Update formatting methods to handle `found` field in Expected errors:
  ```ts
  private formatErrorMessage(error: ParseErr, useColors: boolean = true): string {
    const red = useColors ? "\x1b[31m" : "";
    const yellow = useColors ? "\x1b[33m" : "";
    const reset = useColors ? "\x1b[0m" : "";

    switch (error.tag) {
      case "Expected":
        const foundText = error.found ? `, found ${error.found}` : "";
        return `  ${yellow}Expected:${reset} ${error.items.join(" or ")}${foundText}`;
      case "Unexpected":
        return `  ${red}Unexpected:${reset} ${error.found}`;
      case "Custom":
        return `  ${error.message}`;
      case "Fatal":
        return `  ${red}Fatal:${reset} ${error.message}`;
    }
  }
  ```

#### Task 3.2: Update All Formatter Methods
- [x] **File**: `src/error-formatter.ts`
- [x] **Action**: Update `formatPlain`, `formatHtml`, `formatJson` to handle new `found` field
- [x] **Action**: Update `getPlainErrorMessage` method

### Phase 4: Backward Compatibility Testing

#### Task 4.1: Verify Existing API Still Works
- [x] **File**: Test all existing examples
- [x] **Action**: Ensure these still work without changes:
  ```ts
  Parser.error("message")                    // Should still work
  Parser.fatal("message")                    // Should still work  
  Parser.fail({ message, expected, found }) // Should still work
  parser.expect("description")               // Should still work
  parser.withError(() => "message")         // Should still work
  parser.label("name")                      // Should still work
  ```

#### Task 4.2: Test Examples
- [x] **File**: `examples/js-parser.ts`
- [x] **Action**: Run existing example to ensure no regressions
- [x] **Action**: Add some examples using new API methods

### Phase 5: Documentation and Examples

#### Task 5.1: Update Type Exports
- [ ] **File**: `src/index.ts`
- [ ] **Action**: Ensure all new methods are exported
- [ ] **Action**: Add any new utility types

#### Task 5.2: Add Usage Examples
- [ ] **Action**: Create examples showing new API usage:
  ```ts
  // Simple cases (existing API still works)
  Parser.error("Something went wrong")
  Parser.fatal("Cannot recover")

  // New specific error creators
  Parser.expected([")", "]"], "{")
  Parser.unexpected("}", ["Expected closing paren"])

  // Enhanced error with hints
  Parser.error("Invalid identifier", ["Must start with letter"])

  // Complex cases with unified fail method
  Parser.failWith({
    type: "expected",
    items: ["identifier", "number"],
    found: "string literal", 
    hints: ["Variables must start with letters"]
  })
  ```

#### Task 5.3: Update JSDoc Comments
- [ ] **Action**: Add documentation for all new methods
- [ ] **Action**: Add examples in JSDoc showing when to use each error type

### Phase 6: Advanced Features (Optional)

#### Task 6.1: Error Composition Helpers
- [ ] **File**: `src/parser.ts`
- [ ] **Action**: Add methods for combining/transforming errors:
  ```ts
  // Transform one error type to another
  parser.expectInstead("identifier")  // Converts any error to Expected
  parser.fatalOnError()              // Makes any error fatal
  
  // Add context/hints to existing errors
  parser.withHints(["Try this", "Or that"])
  parser.withContext("parsing function declaration")
  ```

#### Task 6.2: Error Recovery Helpers
- [ ] **File**: `src/parser.ts`
- [ ] **Action**: Add methods for error recovery:
  ```ts
  parser.recoverWith(fallbackParser)    // Try fallback on error
  parser.skipUntil(delimiter)           // Skip to delimiter on error
  ```

## Migration Strategy

### Phase 1: Non-Breaking Enhancements
1. Clean up error types (internal changes only)
2. Add new error creation methods
3. Update formatter to handle new fields

### Phase 2: Documentation and Examples
1. Add examples showing new API
2. Update documentation
3. Create migration guide for users who want to use new features

### Phase 3: Optional Advanced Features
1. Add error composition helpers
2. Add error recovery utilities

## Testing Checklist

After completing refactoring:

- [x] All existing examples parse correctly with no code changes
- [x] Error messages are clearer with new `found` field in Expected errors
- [x] All error formatting options still work
- [x] New error creation methods work as expected
- [x] TypeScript compilation passes without errors
- [x] Performance is not impacted
- [x] All exported types are correct

## Benefits Expected

1. **No Breaking Changes**: All existing code continues to work
2. **Enhanced Error Messages**: Expected errors can show what was found
3. **More Specific Error Creation**: New methods for each error type
4. **Powerful Advanced Usage**: Unified failWith method for complex cases
5. **Gradual Adoption**: Users can adopt new features incrementally
6. **Better Developer Experience**: More semantic error creation methods
7. **Maintained Simplicity**: Simple cases still simple, complex cases possible

## API Summary

### Existing API (Unchanged)
```ts
Parser.error(message: string)              // Creates Custom error
Parser.fatal(message: string)              // Creates Fatal error
Parser.fail({ message, expected, found }) // Creates Custom error
parser.expect("description")               // Creates Expected error on failure
parser.withError(() => "message")         // Converts to Custom error
parser.label("name")                      // Adds to context stack
```

### New API (Additive)
```ts
// Specific error creators
Parser.expected(items: string[], found?: string)
Parser.unexpected(found: string, hints?: string[])

// Enhanced existing methods
Parser.error(message: string, hints?: string[])

// Unified powerful method
Parser.failWith({
  type: "expected" | "unexpected" | "custom" | "fatal",
  message?: string,
  items?: string[],
  found?: string,
  hints?: string[]
})

// Error bundle improvements
errorBundle.toString()                     // Simple formatting
errorBundle.format("ansi" | "html" | etc.) // Rich formatting
```

This approach gives maximum power with zero disruption to existing code!