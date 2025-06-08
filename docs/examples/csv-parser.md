# CSV Parser Example

This example demonstrates building a flexible CSV parser that handles various CSV dialects, escape sequences, and malformed data gracefully.

## Basic CSV Parser

```typescript
import { 
  parser, char, string, or, many0, many1, optional, 
  takeUntil, notChar, between, eof 
} from 'parserator'

// Basic CSV cell (no quotes, no commas)
const simpleCell = takeUntil(or(char(','), char('\n'), eof))
  .map(content => content.trim())

// Quoted cell with escape handling
const quotedCell = between(
  char('"'),
  char('"'),
  many0(or(
    // Escaped quote (double quote)
    string('""').map(() => '"'),
    // Any character except quote
    notChar('"')
  ))
).map(chars => chars.join(''))

// CSV cell (quoted or unquoted)
const csvCell = or(quotedCell, simpleCell)

// CSV row
const csvRow = parser(function* () {
  const first = yield* csvCell
  const rest = yield* many0(char(',').then(csvCell))
  return [first, ...rest]
})

// Basic CSV parser
export const basicCsvParser = parser(function* () {
  const rows = yield* sepBy(csvRow, char('\n'))
  yield* optional(char('\n')) // Optional trailing newline
  yield* eof
  return rows
})
```

## Advanced CSV Parser with Configuration

```typescript
interface CsvConfig {
  delimiter: string
  quote: string
  escape: string
  lineTerminator: string | string[]
  skipEmptyLines: boolean
  trim: boolean
  header: boolean
}

const defaultConfig: CsvConfig = {
  delimiter: ',',
  quote: '"',
  escape: '"',
  lineTerminator: '\n',
  skipEmptyLines: true,
  trim: true,
  header: false
}

function createCsvParser(config: Partial<CsvConfig> = {}) {
  const cfg = { ...defaultConfig, ...config }
  
  // Line terminators
  const lineEnd = Array.isArray(cfg.lineTerminator) 
    ? or(...cfg.lineTerminator.map(term => string(term)))
    : string(cfg.lineTerminator)
  
  // Escaped character in quoted field
  const escapedChar = string(cfg.escape + cfg.quote).map(() => cfg.quote)
  
  // Quoted field content
  const quotedContent = many0(or(
    escapedChar,
    notChar(cfg.quote)
  )).map(chars => chars.join(''))
  
  // Quoted field
  const quotedField = between(
    char(cfg.quote),
    char(cfg.quote),
    quotedContent
  )
  
  // Unquoted field (until delimiter or line end)
  const unquotedField = takeUntil(or(
    char(cfg.delimiter),
    lineEnd,
    eof
  ))
  
  // Field parser
  const field = parser(function* () {
    const content = yield* or(quotedField, unquotedField)
    return cfg.trim ? content.trim() : content
  })
  
  // Row parser
  const row = parser(function* () {
    const first = yield* field
    const rest = yield* many0(char(cfg.delimiter).then(field))
    return [first, ...rest]
  })
  
  // Empty line
  const emptyLine = lineEnd.map(() => null)
  
  // Line parser (row or empty line)
  const line = or(
    row,
    cfg.skipEmptyLines ? emptyLine : row.map(() => [])
  )
  
  // Main CSV parser
  return parser(function* () {
    const lines = yield* many0(line.thenDiscard(optional(lineEnd)))
    yield* eof
    
    // Filter out null lines (empty lines when skipEmptyLines is true)
    const rows = lines.filter(line => line !== null) as string[][]
    
    if (cfg.header && rows.length > 0) {
      const [headerRow, ...dataRows] = rows
      return {
        headers: headerRow,
        rows: dataRows,
        data: dataRows.map(row => 
          Object.fromEntries(headerRow.map((header, i) => [header, row[i] || '']))
        )
      }
    }
    
    return { headers: null, rows, data: rows }
  })
}
```

## Usage Examples

### Basic CSV

```typescript
const basicCsv = `name,age,city
John,30,New York
Jane,25,Boston
Bob,35,Chicago`

const result = basicCsvParser.parse(basicCsv)
console.log(result.value)
// [
//   ['name', 'age', 'city'],
//   ['John', '30', 'New York'],
//   ['Jane', '25', 'Boston'],
//   ['Bob', '35', 'Chicago']
// ]
```

### CSV with Headers

```typescript
const csvWithHeaders = createCsvParser({ header: true })

const result = csvWithHeaders.parse(basicCsv)
console.log(result.value.data)
// [
//   { name: 'John', age: '30', city: 'New York' },
//   { name: 'Jane', age: '25', city: 'Boston' },
//   { name: 'Bob', age: '35', city: 'Chicago' }
// ]
```

### CSV with Quotes and Escapes

```typescript
const complexCsv = `"Product Name","Price","Description"
"Widget ""Pro""","$29.99","A great widget with ""quotes"""
"Simple Widget","$19.99","Basic functionality"
"Gadget, Deluxe","$49.99","Includes comma, and more"`

const result = csvWithHeaders.parse(complexCsv)
console.log(result.value.data)
// [
//   { 
//     'Product Name': 'Widget "Pro"', 
//     'Price': '$29.99', 
//     'Description': 'A great widget with "quotes"' 
//   },
//   { 
//     'Product Name': 'Simple Widget', 
//     'Price': '$19.99', 
//     'Description': 'Basic functionality' 
//   },
//   { 
//     'Product Name': 'Gadget, Deluxe', 
//     'Price': '$49.99', 
//     'Description': 'Includes comma, and more' 
//   }
// ]
```

### Different Delimiters

```typescript
// Tab-separated values
const tsvParser = createCsvParser({ 
  delimiter: '\t',
  header: true 
})

const tsvData = `name\tage\tcity
John\t30\tNew York
Jane\t25\tBoston`

const tsvResult = tsvParser.parse(tsvData)

// Semicolon-separated (European format)
const semiColonParser = createCsvParser({ 
  delimiter: ';',
  header: true 
})

const europeanCsv = `name;age;city
John;30;New York
Jane;25;Boston`
```

## Streaming CSV Parser

For large files, implement a streaming parser:

```typescript
class StreamingCsvParser {
  private buffer = ''
  private config: CsvConfig
  private rowParser: Parser<string[]>
  private headerParsed = false
  private headers: string[] | null = null
  
  constructor(config: Partial<CsvConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    
    // Create row parser (without EOF requirement)
    this.rowParser = this.createRowParser()
  }
  
  private createRowParser() {
    // Similar to above but without EOF
    const field = or(quotedField, unquotedField)
    return parser(function* () {
      const first = yield* field
      const rest = yield* many0(char(this.config.delimiter).then(field))
      return [first, ...rest]
    })
  }
  
  feed(chunk: string): Array<string[] | Record<string, string>> {
    this.buffer += chunk
    const results: any[] = []
    
    while (true) {
      const lineEndIndex = this.buffer.indexOf(this.config.lineTerminator)
      if (lineEndIndex === -1) break
      
      const line = this.buffer.slice(0, lineEndIndex)
      this.buffer = this.buffer.slice(lineEndIndex + this.config.lineTerminator.length)
      
      if (line.trim() === '' && this.config.skipEmptyLines) continue
      
      const parseResult = this.rowParser.parse(line)
      if (parseResult.isRight()) {
        const row = parseResult.value
        
        if (this.config.header && !this.headerParsed) {
          this.headers = row
          this.headerParsed = true
          continue
        }
        
        if (this.headers) {
          const obj = Object.fromEntries(
            this.headers.map((header, i) => [header, row[i] || ''])
          )
          results.push(obj)
        } else {
          results.push(row)
        }
      }
    }
    
    return results
  }
  
  finish(): Array<string[] | Record<string, string>> {
    if (this.buffer.trim()) {
      return this.feed(this.config.lineTerminator)
    }
    return []
  }
}

// Usage
const streamParser = new StreamingCsvParser({ header: true })

// Process chunks as they arrive
const chunk1 = "name,age,city\nJohn,30,"
const chunk2 = "New York\nJane,25,Boston\n"

const results1 = streamParser.feed(chunk1) // []
const results2 = streamParser.feed(chunk2) // [{ name: 'John', age: '30', city: 'New York' }, ...]
const final = streamParser.finish()
```

## Error Handling and Recovery

```typescript
const robustCsvParser = parser(function* () {
  const rows: (string[] | { error: string, line: number })[] = []
  let lineNumber = 1
  
  while (true) {
    const line = yield* takeUntil(or(char('\n'), eof))
    
    if (line === '') {
      const isEof = yield* optional(eof)
      if (isEof) break
      yield* char('\n')
      lineNumber++
      continue
    }
    
    try {
      const rowResult = csvRow.parse(line)
      if (rowResult.isRight()) {
        rows.push(rowResult.value)
      } else {
        rows.push({ 
          error: `Parse error: ${rowResult.error.message}`, 
          line: lineNumber 
        })
      }
    } catch (e) {
      rows.push({ 
        error: `Unexpected error: ${e.message}`, 
        line: lineNumber 
      })
    }
    
    const hasNewline = yield* optional(char('\n'))
    if (!hasNewline) break
    lineNumber++
  }
  
  return rows
})
```

## CSV Validation

```typescript
interface CsvValidationRule {
  column: string | number
  type: 'string' | 'number' | 'email' | 'date' | 'regex'
  required?: boolean
  pattern?: RegExp
  min?: number
  max?: number
}

class CsvValidator {
  constructor(private rules: CsvValidationRule[]) {}
  
  validate(data: Record<string, string>[], headers: string[]): any {
    const errors: any[] = []
    
    data.forEach((row, rowIndex) => {
      this.rules.forEach(rule => {
        const columnName = typeof rule.column === 'number' 
          ? headers[rule.column] 
          : rule.column
        
        const value = row[columnName]
        
        // Required check
        if (rule.required && (!value || value.trim() === '')) {
          errors.push({
            row: rowIndex + 1,
            column: columnName,
            error: 'Required field is empty'
          })
          return
        }
        
        if (!value) return // Skip validation for empty optional fields
        
        // Type validation
        switch (rule.type) {
          case 'number':
            if (isNaN(parseFloat(value))) {
              errors.push({
                row: rowIndex + 1,
                column: columnName,
                error: 'Expected a number'
              })
            }
            break
            
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(value)) {
              errors.push({
                row: rowIndex + 1,
                column: columnName,
                error: 'Invalid email format'
              })
            }
            break
            
          case 'regex':
            if (rule.pattern && !rule.pattern.test(value)) {
              errors.push({
                row: rowIndex + 1,
                column: columnName,
                error: 'Value does not match required pattern'
              })
            }
            break
        }
      })
    })
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

// Usage
const validator = new CsvValidator([
  { column: 'email', type: 'email', required: true },
  { column: 'age', type: 'number', required: true },
  { column: 'phone', type: 'regex', pattern: /^\d{3}-\d{3}-\d{4}$/ }
])

const validationResult = validator.validate(csvData.data, csvData.headers)
```

## Performance Optimizations

### Chunked Processing

```typescript
function processCsvInChunks(
  csvContent: string, 
  chunkSize: number = 1000,
  processor: (rows: any[]) => void
) {
  const parser = createCsvParser({ header: true })
  const lines = csvContent.split('\n')
  
  // Parse header first
  const headerResult = csvRow.parse(lines[0])
  if (headerResult.isLeft()) {
    throw new Error('Invalid CSV header')
  }
  
  const headers = headerResult.value
  let chunk: any[] = []
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue
    
    const rowResult = csvRow.parse(lines[i])
    if (rowResult.isRight()) {
      const row = Object.fromEntries(
        headers.map((header, j) => [header, rowResult.value[j] || ''])
      )
      chunk.push(row)
      
      if (chunk.length >= chunkSize) {
        processor(chunk)
        chunk = []
      }
    }
  }
  
  if (chunk.length > 0) {
    processor(chunk)
  }
}
```

## Testing

```typescript
import { describe, it, expect } from 'vitest'

describe('CSV Parser', () => {
  it('parses basic CSV', () => {
    const csv = 'a,b,c\n1,2,3'
    const result = basicCsvParser.parse(csv)
    expect(result.value).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3']
    ])
  })
  
  it('handles quoted fields', () => {
    const csv = '"hello, world","test"'
    const result = csvRow.parse(csv)
    expect(result.value).toEqual(['hello, world', 'test'])
  })
  
  it('handles escaped quotes', () => {
    const csv = '"He said ""Hello"""'
    const result = csvRow.parse(csv)
    expect(result.value).toEqual(['He said "Hello"'])
  })
  
  it('works with different delimiters', () => {
    const parser = createCsvParser({ delimiter: ';' })
    const csv = 'a;b;c\n1;2;3'
    const result = parser.parse(csv)
    expect(result.value.rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3']
    ])
  })
})
```

This CSV parser implementation handles most real-world CSV variations and provides extensive configuration options for different formats and use cases.
