import { TSDocParser } from "@microsoft/tsdoc";
import * as fs from "fs";
import * as path from "path";
import ts from "typescript";

const tsdocParser = new TSDocParser();

interface DocumentedItem {
  name: string;
  kind: string;
  description: string;
  params?: Array<{ name: string; description: string; type?: string }>;
  returns?: { description: string; type?: string };
  examples?: string[];
  filePath: string;
  lineNumber: number;
}

interface FileDocumentation {
  filePath: string;
  description?: string;
  items: DocumentedItem[];
}

function getNodeName(node: ts.Node): string {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    return node.name?.getText() || "anonymous";
  }
  if (ts.isVariableStatement(node)) {
    const declaration = node.declarationList.declarations[0];
    return declaration.name.getText();
  }
  if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
    return node.name?.getText() || "anonymous";
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return node.name.getText();
  }
  return "unknown";
}

function getNodeKind(node: ts.Node): string {
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isMethodDeclaration(node)) return "method";
  if (ts.isVariableStatement(node)) return "variable";
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "type";
  return "unknown";
}

function extractFileHeaderDoc(sourceFile: ts.SourceFile): string | undefined {
  const fullText = sourceFile.getFullText();
  const firstStatement = sourceFile.statements[0];

  if (!firstStatement) return undefined;

  // Look for comments before the first statement
  const commentRanges = ts.getLeadingCommentRanges(fullText, 0);

  if (commentRanges) {
    for (const range of commentRanges) {
      const commentText = fullText.slice(range.pos, range.end);

      // Check if it's a JSDoc comment (starts with /**)
      if (commentText.startsWith("/**")) {
        const parserContext = tsdocParser.parseString(commentText);
        const docComment = parserContext.docComment;

        if (docComment.summarySection) {
          return renderDocSection(docComment.summarySection);
        }
      }
    }
  }

  return undefined;
}

function extractTSDoc(sourceFile: ts.SourceFile, filePath: string): FileDocumentation {
  const items: DocumentedItem[] = [];
  const fileDescription = extractFileHeaderDoc(sourceFile);

  function visit(node: ts.Node) {
    // Skip the source file node itself to avoid duplicating file-level docs
    if (node.kind === ts.SyntaxKind.SourceFile) {
      ts.forEachChild(node, visit);
      return;
    }

    // Get the leading comment ranges for the node
    const fullText = sourceFile.getFullText();
    const nodeStart = node.getFullStart();
    const commentRanges = ts.getLeadingCommentRanges(fullText, nodeStart);

    if (commentRanges) {
      for (const range of commentRanges) {
        const commentText = fullText.slice(range.pos, range.end);

        // Check if it's a JSDoc comment (starts with /**)
        if (commentText.startsWith("/**")) {
          const parserContext = tsdocParser.parseString(commentText);
          const docComment = parserContext.docComment;

          if (docComment.summarySection) {
            const item: DocumentedItem = {
              name: getNodeName(node),
              kind: getNodeKind(node),
              description: renderDocSection(docComment.summarySection),
              filePath: path.relative(process.cwd(), filePath),
              lineNumber: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
            };

            // Extract @param tags
            if (docComment.params.count > 0) {
              item.params = [];
              for (const paramBlock of docComment.params.blocks) {
                const paramName = paramBlock.parameterName;
                const paramDesc = renderDocSection(paramBlock.content);
                item.params.push({
                  name: paramName,
                  description: paramDesc
                });
              }
            }

            // Extract @returns tag
            if (docComment.returnsBlock) {
              item.returns = {
                description: renderDocSection(docComment.returnsBlock.content)
              };
            }

            // Extract @example tags or code blocks in description
            const examples = extractExamples(commentText);
            if (examples.length > 0) {
              item.examples = examples;
            }

            items.push(item);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return {
    filePath: path.relative(process.cwd(), filePath),
    description: fileDescription,
    items
  };
}

function renderDocSection(section: any): string {
  // Simple text extraction - you might want to enhance this
  let text = "";

  function extractText(node: any) {
    if (node.kind === "PlainText") {
      text += node.text;
    } else if (node.kind === "Paragraph") {
      for (const child of node.nodes || []) {
        extractText(child);
      }
      // Add space after paragraph
      text += " ";
    } else if (node.nodes) {
      for (const child of node.nodes) {
        extractText(child);
      }
    }
  }

  extractText(section);
  return text.trim();
}

function extractExamples(commentText: string): string[] {
  const examples: string[] = [];
  const codeBlockRegex = /```(?:ts|typescript)?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(commentText)) !== null) {
    // Remove leading asterisks and spaces from each line
    const cleanedCode = match[1]
      .split("\n")
      .map(line => line.replace(/^\s*\*\s?/, ""))
      .join("\n")
      .trim();
    examples.push(cleanedCode);
  }

  return examples;
}

function generateFileMarkdown(fileDoc: FileDocumentation): string {
  const fileName = path.basename(fileDoc.filePath, ".ts");
  let markdown = `# ${fileName}\n\n`;

  if (fileDoc.description) {
    markdown += `${fileDoc.description}\n\n`;
    markdown += "---\n\n";
  }

  if (fileDoc.items.length === 0) {
    markdown += "*No documented exports in this file.*\n";
    return markdown;
  }

  for (const item of fileDoc.items) {
    markdown += `## ${item.name}\n\n`;
    markdown += `**Type:** ${item.kind}\n\n`;
    markdown += `${item.description}\n\n`;

    if (item.params && item.params.length > 0) {
      markdown += "**Parameters:**\n\n";
      for (const param of item.params) {
        markdown += `- \`${param.name}\`: ${param.description}\n`;
      }
      markdown += "\n";
    }

    if (item.returns) {
      markdown += `**Returns:** ${item.returns.description}\n\n`;
    }

    if (item.examples && item.examples.length > 0) {
      markdown += "**Examples:**\n\n";
      for (const example of item.examples) {
        markdown += "```typescript\n";
        markdown += example + "\n";
        markdown += "```\n\n";
      }
    }

    markdown += `*Line ${item.lineNumber}*\n\n`;
    markdown += "---\n\n";
  }

  return markdown;
}

function generateIndexMarkdown(fileDocs: FileDocumentation[]): string {
  let markdown = "# API Documentation\n\n";

  markdown += "## Files\n\n";

  for (const fileDoc of fileDocs) {
    const fileName = path.basename(fileDoc.filePath, ".ts");
    const mdFileName = `${fileName}.md`;
    markdown += `- [${fileName}](./${mdFileName})`;
    if (fileDoc.description) {
      markdown += ` - ${fileDoc.description.split("\n")[0]}`; // First line only
    }
    markdown += "\n";
  }

  return markdown;
}

async function generateDocs() {
  const srcDir = path.join(process.cwd(), "src");
  const outputDir = path.join(process.cwd(), "gen-docs");
  const fileDocs: FileDocumentation[] = [];

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create TypeScript compiler host
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    lib: ["es2020"],
    allowJs: false,
    strict: true
  };

  // Get all TypeScript files
  function getAllTsFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getAllTsFiles(fullPath));
      } else if (entry.name.endsWith(".ts")) {
        files.push(fullPath);
      }
    }

    return files;
  }

  const tsFiles = getAllTsFiles(srcDir);

  // Process each file
  for (const filePath of tsFiles) {
    const sourceText = fs.readFileSync(filePath, "utf-8");
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.ES2020, true);

    const fileDoc = extractTSDoc(sourceFile, filePath);
    fileDocs.push(fileDoc);

    // Generate individual file documentation
    const fileName = path.basename(filePath, ".ts");
    const markdown = generateFileMarkdown(fileDoc);
    const outputPath = path.join(outputDir, `${fileName}.md`);
    fs.writeFileSync(outputPath, markdown);
  }

  // Generate index file
  const indexMarkdown = generateIndexMarkdown(fileDocs);
  const indexPath = path.join(outputDir, "index.md");
  fs.writeFileSync(indexPath, indexMarkdown);

  const totalItems = fileDocs.reduce((sum, doc) => sum + doc.items.length, 0);
  console.log(`✅ Documentation generated in: ${outputDir}`);
  console.log(`📝 Documented ${totalItems} items from ${tsFiles.length} files`);
  console.log(`📄 Created ${fileDocs.length + 1} markdown files (including index)`);
}

// Run the generator
generateDocs().catch(console.error);
