# Installation

This guide will help you install and set up Parserator in your TypeScript/JavaScript project.

## Prerequisites

- Node.js 16 or higher
- npm, yarn, pnpm, or bun package manager
- TypeScript 4.5 or higher (for TypeScript projects)

## Package Installation

### Using npm

```bash
npm install parserator
```

### Using yarn

```bash
yarn add parserator
```

### Using pnpm

```bash
pnpm add parserator
```

### Using bun

```bash
bun add parserator
```

## TypeScript Configuration

Parserator is written in TypeScript and provides full type definitions out of the box. For the best experience, ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}
```

## Importing Parserator

### ES Modules (Recommended)

```typescript
// Import specific functions
import { char, string, many1, digit, or } from "parserator";

// Import everything
import * as P from "parserator";

// Import the Parser class
import { Parser } from "parserator";
```

### CommonJS

```javascript
// Import specific functions
const { char, string, many1, digit, or } = require("parserator");

// Import everything
const P = require("parserator");

// Import the Parser class
const { Parser } = require("parserator");
```

## Verification

To verify your installation is working correctly, try this simple example:

```typescript
import { string, char } from "parserator";

const helloParser = string("Hello").then(char(" ")).then(string("World"));
const result = helloParser.parseOrThrow("Hello World");

console.log(result); // Output: "World"
```

If this runs without errors, you're ready to start building parsers!

## Browser Usage

Parserator works in modern browsers that support ES2020. You can use it with bundlers like:

- **Vite**: Works out of the box
- **Webpack**: Configure to handle ES modules
- **Rollup**: Use with ES module plugins
- **esbuild**: Native ES module support

### CDN Usage

For quick prototyping or simple scripts, you can use a CDN:

```html
<script type="module">
  import { string, char } from "https://esm.sh/parserator";

  const parser = string("Hello").then(char(" ")).then(string("World"));
  console.log(parser.parseOrThrow("Hello World"));
</script>
```

## Development Setup

If you want to contribute to Parserator or run the examples:

```bash
# Clone the repository
git clone https://github.com/your-org/parserator.git
cd parserator

# Install dependencies (we recommend bun)
bun install

# Run tests
bun test

# Build the library
bun run build

# Run examples
bun run example:scheme
bun run example:ini
```

## Next Steps

Now that you have Parserator installed, you can:

1. [Create your first parser](./first-parser.md)
2. [Learn the core concepts](./core-concepts.md)
3. [Explore the API reference](../api/parser.md)
4. [Check out examples](../examples/json-parser.md)

## Troubleshooting

### Common Issues

**TypeScript compilation errors:**

- Ensure you're using TypeScript 4.5 or higher
- Check that your `tsconfig.json` has strict mode enabled

**Module resolution issues:**

- Make sure your bundler supports ES modules
- Check that `moduleResolution` is set to `"node"` in your tsconfig

**Runtime errors:**

- Verify you're targeting ES2020 or higher
- Ensure your Node.js version is 16 or higher

### Getting Help

If you encounter issues not covered here:

1. Check the [API documentation](../api/parser.md)
2. Look at the [examples](../examples/)
3. Search [GitHub issues](https://github.com/your-org/parserator/issues)
4. Create a new issue if needed
