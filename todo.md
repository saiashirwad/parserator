# Parser Combinator Library - TODO List

## 🧹 Code Cleanup & Removal

### High Priority
- [ ] **Remove commented code in `src/chain.ts`**
  - Either implement the chain functionality properly or delete the entire file
  - If keeping, add proper implementation and tests
  - If removing, update `src/index.ts` to remove the export

- [ ] **Remove redundant/unused functions**
  - Remove `lookAhead` alias in `src/combinators.ts` (line ~645) - use `lookahead` consistently
  - Evaluate and potentially remove `Parser.selectRight` and `Parser.selectLeft` in `src/parser.ts`
  - Consider removing `sequenceLast` if `sequence` covers the use case adequately
  - Remove any other unused utility functions after dependency analysis

- [ ] **Clean up type definitions**
  - Replace `any` types with more specific types throughout the codebase
  - Create `type AnyParser<Ctx = {}> = Parser<unknown, Ctx>` for better type safety
  - Update function signatures to use the new type

### Medium Priority
- [ ] **Standardize error creation patterns**
  - Create a unified `createError` helper function in `src/errors.ts`
  - Replace all ad-hoc error creation with the standardized function
  - Ensure consistent error structure across all parsers

## 📚 Documentation Improvements

### Root Level Documentation
- [ ] **Create comprehensive README.md**
  - Add installation instructions
  - Include quick start guide with practical examples
  - Document key features (commit/cut, error hints, debugging)
  - Add API overview with links to detailed docs
  - Include performance considerations
  - Add contributing guidelines

- [ ] **Create CHANGELOG.md**
  - Document version history
  - Breaking changes
  - New features and improvements

### Documentation Structure
- [ ] **Create `docs/` directory with:**
  - [ ] `docs/architecture.md` - Internal library architecture
  - [ ] `docs/error-handling.md` - Comprehensive error system guide
  - [ ] `docs/debugging.md` - Debugging strategies and tools
  - [ ] `docs/recipes.md` - Common parsing patterns and examples
  - [ ] `docs/api/` - Detailed API documentation for each module
  - [ ] `docs/migration.md` - Migration guide between versions

### Code Documentation
- [ ] **Enhance JSDoc comments**
  - Add practical examples to all major combinators in `src/combinators.ts`
  - Document the `Parser` class methods with usage examples
  - Add `@example` blocks to complex functions like `or`, `many0`, `sepBy`
  - Document error handling behavior in each combinator

- [ ] **Add type documentation**
  - Document generic type parameters with `@template`
  - Add inline comments for complex type definitions
  - Document the relationship between `Ctx` and `ParserContext`

## 🔧 Code Quality Improvements

### Type Safety
- [ ] **Improve type definitions**
  - Replace remaining `any` types with proper generics
  - Add stricter typing to error handling functions
  - Improve inference for parser combinators
  - Add proper typing for the `gen` function's generator

- [ ] **Add input validation**
  - Validate single character input in `char()` function
  - Add runtime checks for invalid parser configurations
  - Validate regex patterns in `regex()` combinator
  - Add bounds checking for repetition combinators (`count`, `manyN`)

### Error Handling
- [ ] **Simplify error type hierarchy**
  - Consider consolidating the 4 error types into a more unified structure
  - Ensure all error paths provide consistent information
  - Add error recovery mechanisms where appropriate

- [ ] **Improve error messages**
  - Add context-aware error messages
  - Improve hint generation algorithm
  - Add support for custom error formatters
  - Ensure error positions are always accurate

### Performance
- [ ] **Optimize hot paths**
  - Rewrite `many0`/`many1` to use iterative approach instead of recursion
  - Optimize string consumption in `State.consume`
  - Add memoization support for recursive parsers
  - Profile and optimize the `or` combinator for many alternatives

- [ ] **Memory optimization**
  - Reduce object allocations in parser state management
  - Optimize string slicing operations
  - Consider using object pooling for frequently created objects

## 🧪 Testing & Quality Assurance

### Test Infrastructure
- [ ] **Set up comprehensive test suite**
  - Create `tests/` directory structure
  - Add unit tests for all combinators
  - Add integration tests for complex parsing scenarios
  - Add performance benchmarks
  - Set up continuous integration

### Test Coverage
- [ ] **Add specific test cases for:**
  - Error handling and recovery
  - Commit/cut behavior
  - Hint generation accuracy
  - All combinator edge cases
  - Memory usage and performance
  - Different error output formats

## 🏗️ Build & Development Setup

### Build Configuration
- [ ] **Set up proper build pipeline**
  - Configure TypeScript compilation
  - Set up bundling for different environments (Node.js, browser)
  - Add source map generation
  - Configure tree-shaking optimization

### Development Tools
- [ ] **Add development tooling**
  - Set up ESLint with TypeScript rules
  - Configure Prettier for code formatting
  - Add pre-commit hooks
  - Set up automated testing on commit

### Package Configuration
- [ ] **Update package.json**
  - Add proper entry points for different environments
  - Include all necessary metadata
  - Set up proper peer dependencies
  - Configure publishing settings

## 🚀 Feature Enhancements

### Core Features
- [ ] **Implement missing combinators**
  - Add `chainl1`/`chainr1` for operator precedence parsing
  - Add `endBy`/`endBy1` combinators
  - Implement `manyTill` combinator
  - Add `skipManyTill` for efficient skipping

### Advanced Features
- [ ] **Add parser state management**
  - Implement user state threading
  - Add position tracking improvements
  - Support for custom position types
  - Add parser state snapshots/restoration

- [ ] **Enhance debugging capabilities**
  - Add parser execution tracing
  - Implement step-by-step debugging
  - Add performance profiling tools
  - Create visual parser tree representation

## 📦 Distribution & Publishing

### Package Preparation
- [ ] **Prepare for publishing**
  - Set up proper TypeScript declaration files
  - Create multiple build targets (ES5, ES2015, ESM, CommonJS)
  - Add browser compatibility testing
  - Set up automated publishing pipeline

### Documentation Site
- [ ] **Create documentation website**
  - Set up static site generator (e.g., VitePress, Docusaurus)
  - Add interactive examples
  - Create tutorial series
  - Add search functionality

## 🔍 Code Analysis & Refactoring

### Static Analysis
- [ ] **Run comprehensive code analysis**
  - Use TypeScript strict mode
  - Run dependency analysis to find unused code
  - Check for circular dependencies
  - Analyze bundle size and optimization opportunities

### Refactoring Opportunities
- [ ] **Consider architectural improvements**
  - Evaluate if the current state management is optimal
  - Consider separating concerns better (parsing vs error handling)
  - Look for opportunities to reduce coupling between modules
  - Evaluate if the current API surface is intuitive

## 📋 Priority Order

1. **Phase 1 (Immediate)**: Code cleanup, remove unused code, basic documentation
2. **Phase 2 (Short-term)**: Type safety improvements, comprehensive testing
3. **Phase 3 (Medium-term)**: Performance optimization, advanced features
4. **Phase 4 (Long-term)**: Documentation site, publishing preparation

## 🎯 Success Criteria

- [ ] All TypeScript strict mode errors resolved
- [ ] 100% test coverage on core functionality
- [ ] Comprehensive documentation with examples
- [ ] Performance benchmarks showing acceptable performance
- [ ] Clean, maintainable codebase with no unused code
- [ ] Ready for npm publishing with proper build pipeline

---

**Note**: This TODO list assumes there are additional files in the codebase beyond the `src/` folder. Please review and adjust priorities based on the complete project structure and your specific goals.
