# Agent Guidelines for Parserator

## Commands

- **Build**: `bun run build` (runs tsup + build.ts)
- **Test**: `bun test` (all tests) or `bun test tests/combinators.test.ts` (single test file)
- **Typecheck**: `bun run typecheck` (tsc --noEmit)
- **Lint/Format**: `bunx @biomejs/biome check --write .` (Biome handles both)

## Code Style

- **Indentation**: Tabs (not spaces)
- **Quotes**: Double quotes for strings
- **Semicolons**: As needed (omit where possible)
- **Line width**: 80 characters max
- **Imports**: Auto-organized by Biome, re-exports via src/index.ts

## Naming Conventions

- **Types**: PascalCase (e.g., `ParserState`, `ParserOutput`)
- **Functions/Variables**: camelCase (e.g., `parseOrThrow`, `printErrorContext`)
- **Constants**: camelCase (e.g., `stringParser`, not UPPER_CASE)

## Architecture Patterns

- **Parser class**: Functional monadic design with chaining methods (.then, .map, .bind)
- **Error handling**: Custom ParserError with position tracking and context
- **State management**: Immutable ParserState with position tracking
- **Exports**: All public APIs re-exported through src/index.ts

## Advanced Error Handling Roadmap

Implement rich error system with: span-based errors, label/context tracking, automatic hint generation, error recovery combinators, multiple output formats (plain/ansi/html/json), and generator-friendly try/catch support. See full implementation guide for details on ParseErr types, ErrorFormatter, and migration strategy.
