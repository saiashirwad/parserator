#!/usr/bin/env bun

import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join, relative, dirname } from "path";
import { existsSync } from "fs";

interface JSDocComment {
  description: string;
  params: Array<{ name: string; type: string; description: string }>;
  returns?: { type: string; description: string };
  template?: string[];
  examples?: string[];
  internal?: boolean;
  deprecated?: boolean;
}

interface ParsedFunction {
  name: string;
  signature: string;
  jsdoc: JSDocComment;
  isStatic: boolean;
  file: string;
  extractedTypes?: {
    params: Array<{ name: string; type: string; optional?: boolean }>;
    returnType?: string;
    generics?: string[];
  };
}

interface ParsedClass {
  name: string;
  jsdoc: JSDocComment;
  methods: ParsedFunction[];
  staticMethods: ParsedFunction[];
  file: string;
}

/**
 * Remove common leading whitespace from lines while preserving relative indentation
 */
function dedentLines(lines: string[]): string[] {
  if (lines.length === 0) return lines;

  // Find the minimum indentation (excluding empty lines)
  const nonEmptyLines = lines.filter(line => line.trim() !== "");
  if (nonEmptyLines.length === 0) return lines;

  const indentations = nonEmptyLines.map(line => {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  });

  const minIndent = Math.min(...indentations);

  // Remove the common indentation
  return lines.map(line => {
    if (line.trim() === "") return "";
    return line.slice(minIndent);
  });
}

/**
 * Parse JSDoc comment block
 */
function parseJSDoc(comment: string): JSDocComment {
  // Split lines but preserve original indentation for examples
  const rawLines = comment.split("\n");
  const lines = rawLines.map(line => {
    // Remove the leading * and one space, but preserve the rest
    const match = line.match(/^\s*\*\s?(.*)/);
    return match ? match[1] : line;
  });

  const jsdoc: JSDocComment = {
    description: "",
    params: [],
    examples: []
  };

  let currentSection:
    | "description"
    | "param"
    | "returns"
    | "example"
    | "template" = "description";
  let descriptionLines: string[] = [];
  let currentExample: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("@param")) {
      if (currentSection === "example" && currentExample.length > 0) {
        jsdoc.examples!.push(dedentLines(currentExample).join("\n"));
        currentExample = [];
      }
      currentSection = "param";
      const match = trimmedLine.match(
        /@param\s+(?:\{([^}]+)\}\s+)?(\w+)(?:\s+-\s+(.*))?/
      );
      if (match) {
        jsdoc.params.push({
          name: match[2],
          type: match[1] || "unknown",
          description: match[3] || ""
        });
      }
    } else if (
      trimmedLine.startsWith("@returns") ||
      trimmedLine.startsWith("@return")
    ) {
      if (currentSection === "example" && currentExample.length > 0) {
        jsdoc.examples!.push(dedentLines(currentExample).join("\n"));
        currentExample = [];
      }
      currentSection = "returns";
      const match = trimmedLine.match(/@returns?\s+(?:\{([^}]+)\}\s+)?(.*)/);
      if (match) {
        jsdoc.returns = {
          type: match[1] || "unknown",
          description: match[2] || ""
        };
      }
    } else if (trimmedLine.startsWith("@template")) {
      if (currentSection === "example" && currentExample.length > 0) {
        jsdoc.examples!.push(dedentLines(currentExample).join("\n"));
        currentExample = [];
      }
      currentSection = "template";
      const templates = trimmedLine
        .replace("@template", "")
        .trim()
        .split(",")
        .map(t => t.trim());
      jsdoc.template = templates;
    } else if (trimmedLine.startsWith("@example")) {
      if (currentSection === "example" && currentExample.length > 0) {
        jsdoc.examples!.push(dedentLines(currentExample).join("\n"));
      }
      currentSection = "example";
      currentExample = [];
    } else if (trimmedLine.startsWith("@internal")) {
      jsdoc.internal = true;
    } else if (trimmedLine.startsWith("@deprecated")) {
      jsdoc.deprecated = true;
    } else if (trimmedLine && !trimmedLine.startsWith("@")) {
      if (currentSection === "description") {
        descriptionLines.push(trimmedLine);
      } else if (currentSection === "example") {
        // Preserve original indentation for examples
        currentExample.push(line);
      } else if (currentSection === "param" && jsdoc.params.length > 0) {
        const lastParam = jsdoc.params[jsdoc.params.length - 1];
        lastParam.description +=
          (lastParam.description ? " " : "") + trimmedLine;
      } else if (currentSection === "returns" && jsdoc.returns) {
        jsdoc.returns.description +=
          (jsdoc.returns.description ? " " : "") + trimmedLine;
      }
    } else if (currentSection === "example") {
      // Preserve empty lines in examples
      currentExample.push(line);
    }
  }

  // Add final example if exists
  if (currentExample.length > 0) {
    jsdoc.examples!.push(dedentLines(currentExample).join("\n"));
  }

  jsdoc.description = descriptionLines.join(" ").trim();
  return jsdoc;
}

/**
 * Extract a complete function signature from TypeScript content
 */
function extractCompleteSignature(content: string, startIndex: number): string {
  let depth = 0;
  let inString = false;
  let inTemplate = false;
  let stringChar = "";
  let signature = "";

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    const prev = content[i - 1];

    signature += char;

    if (!inString && !inTemplate) {
      if (char === "(" || char === "{" || char === "[") {
        depth++;
      } else if (char === ")" || char === "}" || char === "]") {
        depth--;
      } else if (char === '"' || char === "'" || char === "`") {
        inString = true;
        stringChar = char;
        if (char === "`") inTemplate = true;
      } else if (char === "<" && /[a-zA-Z_$]/.test(prev)) {
        depth++; // Generic type parameter
      } else if (char === ">" && depth > 0) {
        depth--;
      }
    } else {
      if (inTemplate && char === "`" && prev !== "\\") {
        inString = false;
        inTemplate = false;
      } else if (!inTemplate && char === stringChar && prev !== "\\") {
        inString = false;
      }
    }

    // For function expressions/arrow functions, stop at => or end of line
    if (!inString && !inTemplate && depth === 0) {
      if (signature.includes("=>") || char === "\n" || char === ";") {
        break;
      }
    }

    // For regular functions, stop when we close all braces/parens
    if (
      !inString &&
      !inTemplate &&
      depth === 0 &&
      (char === ")" || char === "}")
    ) {
      // Look ahead to see if there's more (like return type annotation)
      let j = i + 1;
      while (j < content.length && /\s/.test(content[j])) j++;
      if (j < content.length && content[j] === ":") {
        // Continue to capture return type
        while (
          j < content.length &&
          content[j] !== "\n" &&
          content[j] !== ";" &&
          content[j] !== "{"
        ) {
          signature += content[j];
          j++;
        }
        i = j - 1;
      }
      break;
    }
  }

  return signature.trim();
}

/**
 * Extract TypeScript types from a function signature
 */
function extractTypesFromSignature(signature: string): {
  params: Array<{ name: string; type: string; optional?: boolean }>;
  returnType?: string;
  generics?: string[];
} {
  const params: Array<{ name: string; type: string; optional?: boolean }> = [];
  let returnType: string | undefined;
  let generics: string[] | undefined;

  // Extract generics if present
  const genericMatch = signature.match(/<([^>]+)>/);
  if (genericMatch) {
    generics = genericMatch[1].split(",").map(g => g.trim());
  }

  // Find parameter list
  const paramMatch = signature.match(/\(([^)]*)\)/);
  if (paramMatch) {
    const paramString = paramMatch[1].trim();
    if (paramString) {
      // Split parameters, handling nested types and default values
      const paramParts = splitParameters(paramString);

      for (const param of paramParts) {
        const paramInfo = parseParameter(param.trim());
        if (paramInfo) {
          params.push(paramInfo);
        }
      }
    }
  }

  // Extract return type
  const returnMatch = signature.match(/\):\s*([^{=]+)/);
  if (returnMatch) {
    returnType = returnMatch[1].trim();
  } else if (signature.includes("=>")) {
    // Arrow function return type
    const arrowMatch = signature.match(/=>\s*([^{]+)/);
    if (arrowMatch) {
      returnType = arrowMatch[1].trim();
    }
  }

  return { params, returnType, generics };
}

/**
 * Split parameter string, respecting nested brackets and commas
 */
function splitParameters(paramString: string): string[] {
  const params: string[] = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < paramString.length; i++) {
    const char = paramString[i];
    const prev = paramString[i - 1];

    if (!inString) {
      if (char === '"' || char === "'" || char === "`") {
        inString = true;
        stringChar = char;
      } else if (char === "(" || char === "[" || char === "{" || char === "<") {
        depth++;
      } else if (char === ")" || char === "]" || char === "}" || char === ">") {
        depth--;
      } else if (char === "," && depth === 0) {
        params.push(current.trim());
        current = "";
        continue;
      }
    } else {
      if (char === stringChar && prev !== "\\") {
        inString = false;
      }
    }

    current += char;
  }

  if (current.trim()) {
    params.push(current.trim());
  }

  return params;
}

/**
 * Parse a single parameter string
 */
function parseParameter(
  param: string
): { name: string; type: string; optional?: boolean } | null {
  // Handle destructured parameters
  if (param.startsWith("{") || param.startsWith("[")) {
    return {
      name: "destructured",
      type: param.split(":")[1]?.trim() || "any"
    };
  }

  // Handle rest parameters
  if (param.startsWith("...")) {
    const rest = param.slice(3);
    const colonIndex = rest.indexOf(":");
    if (colonIndex > 0) {
      return {
        name: rest.slice(0, colonIndex).trim(),
        type: rest.slice(colonIndex + 1).trim()
      };
    }
    return {
      name: rest.trim(),
      type: "any[]"
    };
  }

  // Regular parameter: name?: type = default
  const optional = param.includes("?");
  const hasDefault = param.includes("=");

  // Split on colon to separate name and type
  const colonIndex = param.indexOf(":");
  if (colonIndex === -1) {
    // No type annotation
    const name = param.replace(/[?=].*/, "").trim();
    return {
      name,
      type: "any",
      optional: optional || hasDefault
    };
  }

  const name = param.slice(0, colonIndex).replace("?", "").trim();
  let type = param.slice(colonIndex + 1);

  // Remove default value if present
  const equalIndex = type.indexOf("=");
  if (equalIndex > 0) {
    type = type.slice(0, equalIndex);
  }

  return {
    name,
    type: type.trim(),
    optional: optional || hasDefault
  };
}

/**
 * Extract JSDoc and function signatures from TypeScript content
 */
function extractFromTypeScript(
  content: string,
  filePath: string
): { functions: ParsedFunction[]; classes: ParsedClass[] } {
  const functions: ParsedFunction[] = [];
  const classes: ParsedClass[] = [];

  // Match JSDoc comments followed by declarations
  const jsdocPattern = /\/\*\*([\s\S]*?)\*\//g;

  let match;
  while ((match = jsdocPattern.exec(content)) !== null) {
    const jsdocContent = match[1];
    const jsdoc = parseJSDoc(jsdocContent);

    // Skip internal methods unless explicitly requested
    if (jsdoc.internal) continue;

    // Find the start of the next declaration after the JSDoc
    const afterJsDoc = match.index + match[0].length;
    let declarationStart = afterJsDoc;

    // Skip whitespace
    while (
      declarationStart < content.length &&
      /\s/.test(content[declarationStart])
    ) {
      declarationStart++;
    }

    if (declarationStart >= content.length) continue;

    // Extract the complete signature
    const signature = extractCompleteSignature(content, declarationStart);

    if (signature) {
      // Check if it's a class
      const classMatch = signature.match(/^(?:export\s+)?class\s+(\w+)/);
      if (classMatch) {
        const className = classMatch[1];
        classes.push({
          name: className,
          jsdoc,
          methods: [],
          staticMethods: [],
          file: filePath
        });
        continue;
      }

      // Check if it's a function or method
      const functionPatterns = [
        // export const name =
        /^(?:export\s+)?const\s+(\w+)\s*=\s*/,
        // export function name
        /^(?:export\s+)?function\s+(\w+)\s*\(/,
        // static method
        /^(?:export\s+)?static\s+(\w+)\s*\(/,
        // regular method
        /^(\w+)\s*\(/,
        // property assignment
        /^(\w+)\s*:/
      ];

      for (const pattern of functionPatterns) {
        const functionMatch = signature.match(pattern);
        if (functionMatch) {
          const functionName = functionMatch[1];
          const isStatic = signature.includes("static");
          const extractedTypes = extractTypesFromSignature(signature);

          functions.push({
            name: functionName,
            signature: signature,
            jsdoc,
            isStatic,
            file: filePath,
            extractedTypes
          });
          break;
        }
      }
    }
  }

  return { functions, classes };
}

/**
 * Process a single TypeScript file
 */
async function processFile(
  filePath: string
): Promise<{ functions: ParsedFunction[]; classes: ParsedClass[] }> {
  const content = await readFile(filePath, "utf-8");
  return extractFromTypeScript(content, filePath);
}

/**
 * Recursively find all TypeScript files in a directory
 */
async function findTypeScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findTypeScriptFiles(fullPath)));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Generate markdown documentation for a function
 */
function generateFunctionDoc(func: ParsedFunction): string {
  let md = `### ${func.name}\n\n`;

  if (func.jsdoc.deprecated) {
    md += `:::warning DEPRECATED\nThis function is deprecated.\n:::\n\n`;
  }

  // Clean up the signature for display
  let displaySignature = func.signature;

  // Remove implementation details, keep only the signature
  if (displaySignature.includes("=>")) {
    // Arrow function - keep up to the =>
    displaySignature = displaySignature.split("=>")[0].trim() + " => ...";
  } else if (displaySignature.includes("{")) {
    // Function with body - keep up to the opening brace
    displaySignature = displaySignature.split("{")[0].trim();
  }

  // Add proper TypeScript syntax highlighting
  md += `\`\`\`typescript\n${displaySignature}\n\`\`\`\n\n`;

  if (func.jsdoc.description) {
    md += `${func.jsdoc.description}\n\n`;
  }

  if (func.jsdoc.template && func.jsdoc.template.length > 0) {
    md += `**Type Parameters:**\n\n`;
    for (const template of func.jsdoc.template) {
      md += `- \`${template}\`\n`;
    }
    md += `\n`;
  }

  // Use extracted TypeScript types if available, fallback to JSDoc
  const params =
    func.extractedTypes?.params ||
    func.jsdoc.params.map(p => ({
      name: p.name,
      type: p.type === "unknown" ? "any" : p.type,
      optional: false
    }));

  if (params.length > 0) {
    md += `**Parameters:**\n\n`;
    for (const param of params) {
      // Get description from JSDoc if available
      const jsdocParam = func.jsdoc.params.find(p => p.name === param.name);
      const description = jsdocParam?.description || "";
      const optional = param.optional ? "?" : "";

      md += `- \`${param.name}${optional}\` (\`${param.type}\`)`;
      if (description) {
        md += ` - ${description}`;
      }
      md += `\n`;
    }
    md += `\n`;
  }

  // Use extracted return type if available, fallback to JSDoc
  const returnType =
    func.extractedTypes?.returnType ||
    (func.jsdoc.returns?.type !== "unknown" ?
      func.jsdoc.returns?.type
    : undefined);

  if (returnType) {
    md += `**Returns:** \`${returnType}\``;
    if (func.jsdoc.returns?.description) {
      md += ` - ${func.jsdoc.returns.description}`;
    }
    md += `\n\n`;
  }

  if (func.jsdoc.examples && func.jsdoc.examples.length > 0) {
    md += `**Examples:**\n\n`;
    for (const example of func.jsdoc.examples) {
      // Clean up the example - remove markdown artifacts but preserve indentation
      const cleanExample = example
        .split("\n")
        .map(line => line.replace(/^```\w*\s*/, "").replace(/^```\s*$/, ""))
        .join("\n")
        .trim();

      if (cleanExample) {
        md += `\`\`\`typescript\n${cleanExample}\n\`\`\`\n\n`;
      }
    }
  }

  return md;
}

/**
 * Generate markdown documentation for a class
 */
function generateClassDoc(cls: ParsedClass): string {
  let md = `## ${cls.name}\n\n`;

  if (cls.jsdoc.description) {
    md += `${cls.jsdoc.description}\n\n`;
  }

  if (cls.staticMethods.length > 0) {
    md += `### Static Methods\n\n`;
    for (const method of cls.staticMethods) {
      md += generateFunctionDoc(method);
    }
  }

  if (cls.methods.length > 0) {
    md += `### Instance Methods\n\n`;
    for (const method of cls.methods) {
      md += generateFunctionDoc(method);
    }
  }

  return md;
}

/**
 * Main function to generate API documentation
 */
async function generateAPIDocs() {
  const srcDir = join(process.cwd(), "src");
  const docsApiDir = join(process.cwd(), "docs", "api");

  // Ensure docs/api directory exists
  if (!existsSync(docsApiDir)) {
    await mkdir(docsApiDir, { recursive: true });
  }

  // Find all TypeScript files
  const tsFiles = await findTypeScriptFiles(srcDir);

  const allFunctions: ParsedFunction[] = [];
  const allClasses: ParsedClass[] = [];

  // Process each file
  for (const file of tsFiles) {
    const { functions, classes } = await processFile(file);
    allFunctions.push(...functions);
    allClasses.push(...classes);
  }

  // Group by file/module
  const moduleMap = new Map<
    string,
    { functions: ParsedFunction[]; classes: ParsedClass[] }
  >();

  for (const func of allFunctions) {
    const moduleName = relative(srcDir, func.file).replace(".ts", "");
    if (!moduleMap.has(moduleName)) {
      moduleMap.set(moduleName, { functions: [], classes: [] });
    }
    moduleMap.get(moduleName)!.functions.push(func);
  }

  for (const cls of allClasses) {
    const moduleName = relative(srcDir, cls.file).replace(".ts", "");
    if (!moduleMap.has(moduleName)) {
      moduleMap.set(moduleName, { functions: [], classes: [] });
    }
    moduleMap.get(moduleName)!.classes.push(cls);
  }

  // Generate documentation for each module
  for (const [moduleName, { functions, classes }] of moduleMap) {
    let md = `# ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}\n\n`;

    if (classes.length > 0) {
      for (const cls of classes) {
        md += generateClassDoc(cls);
      }
    }

    if (functions.length > 0) {
      md += `## Functions\n\n`;
      for (const func of functions) {
        md += generateFunctionDoc(func);
      }
    }

    // Write module documentation
    const outputFile = join(docsApiDir, `${moduleName}.md`);
    await writeFile(outputFile, md);
    console.log(`Generated: ${outputFile}`);
  }

  // Generate index file
  let indexMd = `# API Reference\n\n`;
  indexMd += `This section contains the complete API reference for Parserator.\n\n`;

  for (const moduleName of moduleMap.keys()) {
    const title = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
    indexMd += `- [${title}](./${moduleName}.md)\n`;
  }

  await writeFile(join(docsApiDir, "index.md"), indexMd);
  console.log(`Generated: ${join(docsApiDir, "index.md")}`);

  console.log(`\nGenerated API documentation for ${moduleMap.size} modules`);
}

// Run the script
if (import.meta.main) {
  generateAPIDocs().catch(console.error);
}
