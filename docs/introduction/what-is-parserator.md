# What is Parserator?

Parserator is an elegant and powerful parser combinators library for TypeScript. It provides a functional approach to building parsers by composing small, reusable parsing functions into complex parsers.

## Why Parser Combinators?

Traditional parsing approaches often involve:

- Complex grammar files and code generation
- Steep learning curves
- Limited composability and reusability
- Difficulty handling errors gracefully

Parser combinators offer a different approach:

- **Composable**: Build complex parsers from simple building blocks
- **Type-safe**: Full TypeScript support with excellent type inference
- **Functional**: Pure functions that are easy to test and reason about
- **Flexible**: Handle any grammar, including context-sensitive ones
- **Error-friendly**: Rich error reporting with position tracking

## Key Features

### 🎯 **Type Safety**

```typescript
const parser: Parser<number> = many1(digit).map(digits =>
  parseInt(digits.join(""))
);
// TypeScript knows the result is a number
```

### 🔧 **Composability**

```typescript
const identifier = many1(alphabet);
const assignment = sequence([identifier, char("="), expression]);
const program = many0(assignment);
```

### 🚀 **Monadic Interface**

```typescript
const jsonObject = parser(function* () {
  yield* char("{");
  const properties = yield* sepBy(property, char(","));
  yield* char("}");
  return Object.fromEntries(properties);
});
```

### 📍 **Rich Error Reporting**

```typescript
// Input: "if x > 5 {"
// Error: "Expected closing parenthesis at line 1, column 9"
//        "if x > 5 {"
//                 ^
```

### ⚡ **Performance Optimized**

- Minimal backtracking with commit/cut operations
- Atomic parsers for better performance
- Optional memoization for recursive grammars

## Use Cases

Parserator is perfect for:

### **Configuration Files**

```typescript
const config = parser(function* () {
  const entries = yield* many0(configEntry);
  return Object.fromEntries(entries);
});
```

### **Domain Specific Languages**

```typescript
const sqlQuery = parser(function* () {
  yield* keyword("SELECT");
  const columns = yield* sepBy1(identifier, char(","));
  yield* keyword("FROM");
  const table = yield* identifier;
  return { type: "select", columns, table };
});
```

### **Data Formats**

```typescript
const csvParser = parser(function* () {
  const header = yield* csvRow;
  const rows = yield* many0(csvRow);
  return { header, rows };
});
```

### **Template Languages**

```typescript
const template = many0(
  or(
    variable, // {{name}}
    conditional, // {{#if condition}}
    text // literal text
  )
);
```

## Comparison with Alternatives

| Feature        | Parserator         | Regex          | PEG.js      | ANTLR            |
| -------------- | ------------------ | -------------- | ----------- | ---------------- |
| Type Safety    | ✅ Full TypeScript | ❌ String only | ⚠️ Limited  | ⚠️ Generated     |
| Composability  | ✅ Excellent       | ❌ Poor        | ⚠️ Limited  | ❌ Grammar-bound |
| Error Messages | ✅ Rich context    | ❌ Basic       | ⚠️ Basic    | ✅ Good          |
| Learning Curve | ⚠️ Moderate        | ✅ Low         | ⚠️ Moderate | ❌ Steep         |
| Runtime Deps   | ✅ Zero            | ✅ Zero        | ❌ Runtime  | ❌ Runtime       |
| Bundle Size    | ✅ Small           | ✅ Zero        | ⚠️ Medium   | ❌ Large         |

## Philosophy

Parserator follows these principles:

### **Simplicity**

Start with simple parsers and compose them into complex ones. Every parser is just a function.

### **Predictability**

Parsers behave consistently. No hidden state or surprising behaviors.

### **Expressiveness**

The API maps naturally to how you think about parsing problems.

### **Performance**

Fast parsing with minimal overhead, while maintaining readability.

### **Developer Experience**

Excellent TypeScript integration, clear error messages, and helpful debugging tools.

## Getting Started

Ready to try Parserator? Check out the [Getting Started Guide](../guide/getting-started.md) to begin building your first parser.

Or jump straight into the [Basic Concepts](../guide/basic-concepts.md) to understand the fundamentals.

## Community

- **GitHub**: [saiashirwad/parserator](https://github.com/saiashirwad/parserator)
- **Issues**: Report bugs and request features
- **Discussions**: Ask questions and share your parsers

---

_Parserator: Parse with confidence, compose with elegance._
