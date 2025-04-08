export type Prettify<T> = { [K in keyof T]: T[K] } & {}

export type Last<T> = T extends [...any[], infer L] ? L : never
