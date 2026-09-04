export type ComparisonOperator = ":" | "=" | "!=" | ">" | ">=" | "<" | "<="

export type Value = string | number

export type Query =
  | {
      readonly type: "comparison"
      readonly field: string
      readonly operator: ComparisonOperator
      readonly value: Value
    }
  | {
      readonly type: "logical"
      readonly operator: "AND" | "OR"
      readonly left: Query
      readonly right: Query
    }

export const Query = {
  comparison: (
    field: string,
    operator: ComparisonOperator,
    value: Value
  ): Query => ({ type: "comparison", field, operator, value }),
  logical: (operator: "AND" | "OR", left: Query, right: Query): Query => ({
    type: "logical",
    operator,
    left,
    right
  })
}
