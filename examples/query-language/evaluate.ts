import type { Query, Value } from "./ast.ts"

function fieldValue(record: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((value, part) => {
    if (typeof value !== "object" || value === null) return undefined
    return (value as Record<string, unknown>)[part]
  }, record)
}

function compare(
  actual: unknown,
  operator: Exclude<Query, { type: "logical" }>["operator"],
  expected: Value
): boolean {
  if (operator === ":") return String(actual) === String(expected)
  if (operator === "=") return actual === expected
  if (operator === "!=") return actual !== expected
  if (typeof actual !== "number" || typeof expected !== "number") return false
  if (operator === ">") return actual > expected
  if (operator === ">=") return actual >= expected
  if (operator === "<") return actual < expected
  return actual <= expected
}

/** Evaluate a parsed query against a flat or dotted-path object. */
export function evaluate(
  query: Query,
  record: Record<string, unknown>
): boolean {
  if (query.type === "logical") {
    if (query.operator === "AND") {
      return evaluate(query.left, record) && evaluate(query.right, record)
    }
    return evaluate(query.left, record) || evaluate(query.right, record)
  }
  return compare(fieldValue(record, query.field), query.operator, query.value)
}
