# Error System Refactoring TODO

This document outlines the tasks needed to simplify and unify the error handling system in parserator.

## Current State Analysis

### Files Involved
- `src/state.ts` - Parser state and context management
- `src/errors.ts` - Error types and ParseErrorBundle
- `src/error-formatter.ts` - Rich error formatting with multiple output formats
- `src/parser.ts` - Parser class with error creation methods

### Current Error Types
- `ExpectedParseErr` - When specific tokens/patterns were expected
- `UnexpectedParseErr` - When unexpected input was found
- `CustomParseErr` - Custom error messages with optional hints
- `FatalParseErr` - Fatal errors that prevent backtracking

## Refactoring Tasks

### Phase 1: Consolidate Error Types

#### Task 1.1: Simplify ParseErr Union Type
- [ ] **File**: `src/errors.ts`
- [ ] **Action**: Replace 4-variant union with 2-variant union:
  ```ts
  export type ParseError =
    | {
        type: "expected";
        span: Span;
        items: string[];
        found?: string;
        context: string[]
      }
    | {
        type: "parse";
        span: Span;
        message: string;
        context: string[];
        hints?: string[];
        fatal?: boolean;  // Replaces separate Fatal type
      };
      ```

#### Task 1.2: Update ParseErrorBundle
- [ ] **File**: `src/errors.ts`
- [ ] **Action**: Update ParseErrorBundle to use new ParseError type
- [ ] **Action**: Add simple toString() method for basic formatting:
  ```ts
  toString(): string {
    const err = this.primary;
    return err.type === "expected"
      ? `Expected ${err.items.join(" or ")}${err.found ? `, found ${err.found}` : ""}`
      : err.message;
  }
  ```

#### Task 1.3: Add Optional Rich Formatting
- [ ] **File**: `src/errors.ts`
- [ ] **Action**: Add format() method that uses ErrorFormatter when needed:
  ```ts
  format(format: "plain" | "ansi" | "html" | "json" = "plain"): string {
    return new ErrorFormatter(format).format(this);
  }
  ```

### Phase 2: Simplify Parser Error API

#### Task 2.1: Consolidate Error Creation Methods
- [ ] **File**: `src/parser.ts`
- [ ] **Action**: Replace `Parser.fail`, `Parser.error`, `Parser.fatal` with:
  ```ts
  static error(message: string, fatal = false): Parser<never, Ctx>
  static expected(items: string[], found?: string): Parser<never, Ctx>
  static fatal(message: string): Parser<never, Ctx> // Keep as convenience
  ```

#### Task 2.2: Update failRich Method
- [ ] **File**: `src/parser.ts`
- [ ] **Action**: Update `failRich` to work with new ParseError type
- [ ] **Action**: Rename to `failWith` for clarity

#### Task 2.3: Update Error Context Handling
- [ ] **File**: `src/parser.ts`
- [ ] **Action**: Update all error creation to use `state.context?.labelStack` as context

### Phase 3: Unify Context Management

#### Task 3.1: Consolidate Context Properties
- [ ] **File**: `src/state.ts`
- [ ] **Action**: Rename `labelStack` to `parseStack` for clarity
- [ ] **Action**: Consider whether we need both `labelStack` and separate context tracking

#### Task 3.2: Update Label Method
- [ ] **File**: `src/parser.ts`
- [ ] **Action**: Update `.label()` method to use unified context property

### Phase 4: Update ErrorFormatter

#### Task 4.1: Update ErrorFormatter for New Types
- [ ] **File**: `src/error-formatter.ts`
- [ ] **Action**: Update all formatting methods to handle new ParseError union
- [ ] **Action**: Update `formatErrorMessage` to handle new structure
- [ ] **Action**: Update `getPlainErrorMessage` method

#### Task 4.2: Update Helper Methods
- [ ] **File**: `src/error-formatter.ts`
- [ ] **Action**: Update `getHints` method to work with new error structure

### Phase 5: Update All Usage Sites

#### Task 5.1: Update Examples
- [ ] **File**: `examples/js-parser.ts`
- [ ] **Action**: Update any direct error creation or handling
- [ ] **Action**: Test that all error cases still work correctly

#### Task 5.2: Update Combinators
- [ ] **File**: `src/combinators.ts` (if it exists)
- [ ] **Action**: Update any error creation in combinator functions

#### Task 5.3: Update Tests
- [ ] **Files**: Any test files
- [ ] **Action**: Update test expectations for new error format
- [ ] **Action**: Add tests for new simplified API

### Phase 6: Documentation and Cleanup

#### Task 6.1: Update Type Exports
- [ ] **File**: `src/index.ts`
- [ ] **Action**: Update exports to use new ParseError type instead of ParseErr
- [ ] **Action**: Ensure all new methods are exported

#### Task 6.2: Update Documentation
- [ ] **Action**: Update any JSDoc comments that reference old error types
- [ ] **Action**: Add examples for new simplified error API

#### Task 6.3: Backward Compatibility
- [ ] **Action**: Consider adding type aliases for backward compatibility:
  ```ts
  /** @deprecated Use ParseError instead */
  export type ParseErr = ParseError;
  ```

## Migration Strategy

### Approach 1: Big Bang (Recommended)
- Complete all tasks in sequence
- Ensures consistency across codebase
- Easier to reason about changes

### Approach 2: Gradual Migration
- Keep old types alongside new ones temporarily
- Migrate usage sites one by one
- Remove old types in final step

## Testing Checklist

After completing refactoring:

- [ ] All existing examples still parse correctly
- [ ] Error messages are still clear and helpful
- [ ] All error formatting options still work
- [ ] Performance is not significantly impacted
- [ ] TypeScript compilation passes without errors
- [ ] All exported types are correct

## Benefits Expected

1. **Reduced Complexity**: 2 error types instead of 4
2. **Cleaner API**: Fewer static methods on Parser class
3. **Graduated Complexity**: Simple toString() for basic cases, rich formatting when needed
4. **Better Maintainability**: Less code duplication in error handling
5. **Preserved Power**: All existing features (spans, context, fatal errors, hints) still available

## Risk Assessment

**Low Risk**:
- Type consolidation (mostly mechanical changes)
- Adding convenience methods

**Medium Risk**:
- Changing error creation API (affects many call sites)
- Updating ErrorFormatter (complex logic)

**Mitigation**:
- Keep good test coverage during refactoring
- Consider keeping old API temporarily with deprecation warnings
- Update examples first to validate new API works well
