/**
 * Examples demonstrating the beautiful error formatting capabilities of parserator.
 * Shows how to use ErrorFormatter with different output formats and rich error messages.
 */

import { ErrorFormatter, formatError } from "../src/error-formatter"
import { anyKeywordWithHints, keywordWithHints } from "../src/hints"
import { type ParseErr, ParseErrorBundle } from "../src/rich-errors"
import { or, sequence, char, regex, many0 } from "../src/combinators"
import { Either } from "../src/either"
import { Parser } from "../src/parser"

// Create some sample parsers with rich error support
const jsKeywords = ["function", "const", "let", "var", "class", "if", "else", "return"]
const jsKeyword = anyKeywordWithHints(jsKeywords).label("JavaScript keyword")

const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/).label("identifier")
const number = regex(/\d+/).label("number")

const functionDeclaration = Parser.gen(function* () {
	yield* keywordWithHints(jsKeywords)("function").label("function keyword")
	yield* char(" ").label("space")
	const name = yield* identifier.label("function name")
	yield* char("(").label("opening parenthesis")
	const params = yield* many0(sequence([
		identifier.label("parameter"),
		or(char(","), char(")")).label("comma or closing paren")
	])).label("parameters")
	yield* char("{").label("opening brace")
	
	return {
		type: "function" as const,
		name,
		params: params.map(p => p[0])
	}
}).label("function declaration")

console.log("🎨 Beautiful Error Formatting Examples\n")
console.log("=".repeat(50))

// Example 1: Plain text formatting
console.log("\n📝 PLAIN TEXT FORMAT")
console.log("-".repeat(30))

const invalidJs = "functoin test() {"
const result1 = functionDeclaration.parse(invalidJs)

if (Either.isLeft(result1.result)) {
	// Create a mock rich error bundle for demonstration
	const richError: ParseErr = {
		tag: "Unexpected",
		span: { offset: 0, length: 8, line: 1, column: 1 },
		found: "functoin",
		context: ["function declaration", "function keyword"],
		hints: ["function"]
	}
	
	const bundle = new ParseErrorBundle([richError], invalidJs)
	const plainFormatter = new ErrorFormatter("plain")
	console.log(plainFormatter.format(bundle))
}

console.log("\n🌈 ANSI COLOR FORMAT")
console.log("-".repeat(30))

if (Either.isLeft(result1.result)) {
	const richError: ParseErr = {
		tag: "Unexpected",
		span: { offset: 0, length: 8, line: 1, column: 1 },
		found: "functoin",
		context: ["function declaration", "function keyword"],
		hints: ["function"]
	}
	
	const bundle = new ParseErrorBundle([richError], invalidJs)
	const ansiFormatter = new ErrorFormatter("ansi")
	console.log(ansiFormatter.format(bundle))
}

// Example 2: Multi-line code with context
console.log("\n📖 MULTI-LINE CODE WITH CONTEXT")
console.log("-".repeat(40))

const multiLineCode = `class MyClass {
  cunstructor(name) {
    this.name = name;
  }
  
  getName() {
    return this.name;
  }
}`

const constructorError: ParseErr = {
	tag: "Unexpected",
	span: { offset: 18, length: 11, line: 2, column: 3 },
	found: "cunstructor",
	context: ["class declaration", "method"],
	hints: ["constructor"]
}

const multiLineBundle = new ParseErrorBundle([constructorError], multiLineCode)
const contextFormatter = new ErrorFormatter("ansi", { 
	maxContextLines: 5,
	showHints: true,
	showContext: true 
})

console.log(contextFormatter.format(multiLineBundle))

// Example 3: HTML formatting
console.log("\n🌐 HTML FORMAT")
console.log("-".repeat(20))

const htmlBundle = new ParseErrorBundle([constructorError], multiLineCode)
const htmlFormatter = new ErrorFormatter("html")
console.log(htmlFormatter.format(htmlBundle))

// Example 4: JSON formatting
console.log("\n📊 JSON FORMAT")
console.log("-".repeat(20))

const jsonBundle = new ParseErrorBundle([constructorError], multiLineCode)
const jsonFormatter = new ErrorFormatter("json", { tabSize: 2 })
console.log(jsonFormatter.format(jsonBundle))

// Example 5: Multiple errors
console.log("\n🔥 MULTIPLE ERRORS")
console.log("-".repeat(25))

const problematicCode = `if (x = 5) {
  consol.log("test");
  retrn true;
}`

const errors: ParseErr[] = [
	{
		tag: "Expected",
		span: { offset: 6, length: 1, line: 1, column: 7 },
		items: ["comparison operator"],
		context: ["if statement", "condition"]
	},
	{
		tag: "Unexpected", 
		span: { offset: 15, length: 6, line: 2, column: 3 },
		found: "consol",
		context: ["statement", "expression"],
		hints: ["console"]
	},
	{
		tag: "Unexpected",
		span: { offset: 37, length: 5, line: 3, column: 3 },
		found: "retrn", 
		context: ["statement"],
		hints: ["return"]
	}
]

const multiErrorBundle = new ParseErrorBundle(errors, problematicCode)
console.log(formatError.ansi(multiErrorBundle))

// Example 6: Different formatting options
console.log("\n⚙️ FORMATTING OPTIONS")
console.log("-".repeat(30))

// Minimal format - no hints, no context
const minimalFormatter = new ErrorFormatter("plain", {
	showHints: false,
	showContext: false,
	maxContextLines: 1
})

console.log("Minimal format:")
console.log(minimalFormatter.format(multiErrorBundle))

console.log("\nVerbose format:")
const verboseFormatter = new ErrorFormatter("ansi", {
	showHints: true,
	showContext: true,
	maxContextLines: 7
})

console.log(verboseFormatter.format(multiErrorBundle))

// Example 7: CSS with suggested colors
console.log("\n🎨 CSS COLOR SUGGESTIONS")
console.log("-".repeat(35))

const cssCode = `body {
  color: gren;
  background: bleu;
}`

const cssColorError: ParseErr = {
	tag: "Custom",
	span: { offset: 15, length: 4, line: 2, column: 10 },
	message: "Invalid CSS color",
	hints: ["green", "grey"],
	context: ["style rule", "property value"]
}

const cssBundle = new ParseErrorBundle([cssColorError], cssCode)
console.log(formatError.ansi(cssBundle))

