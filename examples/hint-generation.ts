/**
 * Examples demonstrating the hint generation capabilities of parserator.
 * These examples show how to use the new hint system for better error messages.
 */

import { or, sequence, char, regex, many0, sepBy } from "../src/combinators"
import { Either } from "../src/either"
import { anyKeywordWithHints, keywordWithHints, stringWithHints } from "../src/hints"
import { Parser } from "../src/parser"

// Example 1: JavaScript keyword parser with hints
console.log("=== JavaScript Keyword Parser ===")

const jsKeywords = [
	"function", "const", "let", "var", "class", "if", "else",
	"for", "while", "return", "import", "export", "default",
	"async", "await", "try", "catch", "finally"
]

const jsKeyword = anyKeywordWithHints(jsKeywords).label("JavaScript keyword")

// Test various typos
const jsTestCases = [
	"function",  // correct
	"functoin",  // typo -> should suggest "function"
	"retrun",    // typo -> should suggest "return"
	"calss",     // typo -> should suggest "class"
	"awiat",     // typo -> should suggest "await"
]

for (const testCase of jsTestCases) {
	const result = jsKeyword.parse(testCase)
	if (Either.isRight(result.result)) {
		console.log(`✓ "${testCase}" -> ${result.result.right}`)
	} else {
		console.log(`✗ "${testCase}" -> ${result.result.left.message}`)
	}
}

console.log()

// Example 2: Scheme/Lisp parser with contextual hints
console.log("=== Scheme Parser with Hints ===")

const schemeKeywords = ["lambda", "let", "if", "cond", "define", "quote", "car", "cdr"]

const identifier = regex(/[a-zA-Z_][a-zA-Z0-9_]*/).label("identifier")
const number = regex(/\d+/).label("number")

const lambdaKeyword = keywordWithHints(schemeKeywords)("lambda").label("lambda keyword")
const defineKeyword = keywordWithHints(schemeKeywords)("define").label("define keyword")

// Simple lambda expression parser
const lambdaExpr = Parser.gen(function* () {
	yield* char("(").label("opening parenthesis")
	yield* lambdaKeyword
	yield* char(" ").label("space")
	yield* char("(").label("parameter list start")
	const params = yield* sepBy(char(" "), identifier).label("parameters")
	yield* char(")").label("parameter list end")
	yield* char(" ").label("space")
	const body = yield* or(number, identifier).label("lambda body")
	yield* char(")").label("closing parenthesis")
	
	return {
		type: "lambda" as const,
		params,
		body
	}
}).label("lambda expression")

const schemeTestCases = [
	"(lambda (x) x)",     // correct
	"(lamdba (x) x)",     // typo in lambda
	"(lambda (x) x",      // missing closing paren
	"(define x 42)",      // different keyword
]

for (const testCase of schemeTestCases) {
	const result = lambdaExpr.parse(testCase)
	if (Either.isRight(result.result)) {
		console.log(`✓ "${testCase}" -> ${JSON.stringify(result.result.right)}`)
	} else {
		console.log(`✗ "${testCase}" -> ${result.result.left.message}`)
	}
}

console.log()

// Example 3: CSS color parser with hints
console.log("=== CSS Color Parser ===")

const cssColors = [
	"red", "green", "blue", "yellow", "orange", "purple", "pink",
	"black", "white", "gray", "cyan", "magenta", "brown", "lime"
]

const cssColorParser = stringWithHints(cssColors).label("CSS color")

const cssTestCases = [
	'"red"',      // correct
	'"gren"',     // typo -> should suggest "green"
	'"bleu"',     // typo -> should suggest "blue"
	'"purpel"',   // typo -> should suggest "purple"
	'"orange"',   // correct
]

for (const testCase of cssTestCases) {
	const result = cssColorParser.parse(testCase)
	if (Either.isRight(result.result)) {
		console.log(`✓ ${testCase} -> ${result.result.right}`)
	} else {
		console.log(`✗ ${testCase} -> ${result.result.left.message}`)
	}
}

console.log()

// Example 4: SQL parser with hints
console.log("=== SQL Parser with Hints ===")

const sqlKeywords = ["SELECT", "FROM", "WHERE", "ORDER", "GROUP", "INSERT", "UPDATE", "DELETE", "JOIN", "INNER", "LEFT", "RIGHT"]

const selectKeyword = keywordWithHints(sqlKeywords)("SELECT").label("SELECT keyword")
const fromKeyword = keywordWithHints(sqlKeywords)("FROM").label("FROM keyword")

const simpleSelectParser = Parser.gen(function* () {
	yield* selectKeyword
	yield* char(" ").label("space")
	yield* char("*").label("asterisk")
	yield* char(" ").label("space")
	yield* fromKeyword
	yield* char(" ").label("space")
	const tableName = yield* identifier.label("table name")
	
	return {
		type: "select" as const,
		columns: ["*"],
		table: tableName
	}
}).label("SELECT statement")

const sqlTestCases = [
	"SELECT * FROM users",    // correct
	"SLECT * FROM users",     // typo in SELECT
	"SELECT * FORM users",    // typo in FROM
	"SELECT * FROM users",    // correct again
]

for (const testCase of sqlTestCases) {
	const result = simpleSelectParser.parse(testCase)
	if (Either.isRight(result.result)) {
		console.log(`✓ "${testCase}" -> ${JSON.stringify(result.result.right)}`)
	} else {
		console.log(`✗ "${testCase}" -> ${result.result.left.message}`)
	}
}

console.log()

// Example 5: Configuration file parser with hints
console.log("=== Config Parser with Hints ===")

const configKeys = ["host", "port", "database", "username", "password", "timeout", "retries", "ssl"]

const configKeyParser = anyKeywordWithHints(configKeys).label("configuration key")
const configValue = regex(/[a-zA-Z0-9_.-]+/).label("configuration value")

const configLineParser = Parser.gen(function* () {
	const key = yield* configKeyParser
	yield* char("=").label("equals sign")
	const value = yield* configValue
	
	return { key, value }
}).label("configuration line")

const configTestCases = [
	"host=localhost",        // correct
	"prot=3306",            // typo -> should suggest "port"
	"databse=mydb",         // typo -> should suggest "database"
	"timeout=30",           // correct
	"usrname=admin",        // typo -> should suggest "username"
]

for (const testCase of configTestCases) {
	const result = configLineParser.parse(testCase)
	if (Either.isRight(result.result)) {
		console.log(result)
	} else {
		console.log(`✗ "${testCase}" -> ${result.result.left.message}`)
	}
}

