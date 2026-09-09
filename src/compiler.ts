import type { Failure } from "./errors.ts"
import { getRunner, makeParser, type Parser } from "./parser.ts"
import {
  ParserOutput,
  State,
  type ParserReply,
  type ParserState
} from "./state.ts"

// Private grammar metadata. Callbacks and grammar data are passed by reference,
// never serialized into JavaScript source or executed during compilation.
type AnyParser = Parser<any>
export type Plan =
  | { kind: "literal" | "char"; value: string }
  | { kind: "regex"; expression: RegExp }
  | {
      kind: "satisfy"
      predicate: (char: string) => boolean
      failure: (state: ParserState) => ParserReply<never>
    }
  | { kind: "takeWhile"; predicate: (char: string) => boolean }
  | { kind: "succeed"; value: unknown }
  | { kind: "map"; inner: AnyParser; callback: (value: any) => unknown }
  | { kind: "flatMap"; inner: AnyParser; callback: (value: any) => AnyParser }
  | { kind: "zip" | "zipLeft" | "zipRight"; left: AnyParser; right: AnyParser }
  | {
      kind: "reply"
      inner: AnyParser
      transform: (
        reply: ParserReply<any>,
        entry: ParserState
      ) => ParserReply<any>
    }
  | { kind: "many"; inner: AnyParser; discard: boolean }
  | {
      kind: "list"
      inner: AnyParser
      separator: AnyParser
      allowTrailing: boolean
      requireOne: boolean
    }
  | {
      kind: "choice"
      alternatives: readonly AnyParser[]
      merge: (failures: [Failure, ...Failure[]]) => Failure
    }
  | { kind: "generator"; factory: () => Generator<AnyParser, any, any> }
  | { kind: "recursive"; get: () => AnyParser }
  | { kind: "sequence"; items: readonly AnyParser[] }
  | { kind: "count"; inner: AnyParser; count: number }

const plans = new WeakMap<object, Plan>()
const compiled = new WeakMap<object, AnyParser>()

export function planned<T>(parser: Parser<T>, plan: Plan): Parser<T> {
  plans.set(parser, plan)
  return parser
}

type Frame = {
  state: ParserState
  value: unknown
  failure: ParserReply<never> | undefined
}
type Step = (frame: Frame) => boolean

function clearContext(state: ParserState): ParserState {
  if (!state.completionContext) return state
  const { completionContext: _context, ...rest } = state
  return rest
}

function accept(frame: Frame, reply: ParserReply<unknown>): boolean {
  if (!reply.result.ok) {
    frame.failure = reply as ParserReply<never>
    return false
  }
  frame.state = reply.state
  frame.value = reply.result.value
  return true
}

function stopped(frame: Frame, state: ParserState): boolean {
  const reply = frame.failure!
  if (reply.result.ok) return false
  const control = reply.result.failure.control
  return control.kind === "fatal" || control.cutGeneration > state.cutGeneration
}

/** Compile once, without changing the original parser or its runners. */
export function compile<T>(parser: Parser<T>): Parser<T> {
  const existing = compiled.get(parser)
  if (existing) return existing as Parser<T>

  // A compiler session owns its dynamic cache. Weak keys avoid retaining parsers
  // constructed inside generators/flatMap. Only reused dynamic parsers are JITed.
  const steps = new WeakMap<object, Step>()
  const seen = new WeakSet<object>()
  const dynamic = (inner: AnyParser, frame: Frame): boolean => {
    const cached = steps.get(inner)
    if (cached) return cached(frame)
    if (seen.has(inner)) return build(inner)(frame)
    seen.add(inner)
    return accept(frame, getRunner(inner)(frame.state))
  }
  const lazy = (get: () => AnyParser): Step => {
    let step: Step | undefined
    return frame => (step ??= build(get()))(frame)
  }
  const generate = (
    factory: () => Generator<AnyParser, any, any>,
    frame: Frame
  ): boolean => {
    const iterator = factory()
    let closed = false
    const close = () => {
      if (closed) return
      closed = true
      iterator.return?.(undefined as never)
    }
    try {
      let current = iterator.next()
      while (!current.done) {
        if (!dynamic(current.value, frame)) {
          close()
          return false
        }
        current = iterator.next(frame.value)
      }
      closed = true
      frame.value = current.value
      frame.state = clearContext(frame.state)
      return true
    } catch (error) {
      close()
      throw error
    }
  }

  function build(root: AnyParser): Step {
    const cached = steps.get(root)
    if (cached) return cached
    const ids = new Map<AnyParser, number>()
    const queue: AnyParser[] = []
    const refs: unknown[] = []
    const ref = (value: unknown): string => `r[${refs.push(value) - 1}]`
    const target = (inner: AnyParser): string => {
      const ready = steps.get(inner)
      if (ready) return ref(ready)
      let id = ids.get(inner)
      if (id === undefined) {
        id = queue.length
        ids.set(inner, id)
        queue.push(inner)
      }
      return `p${id}`
    }
    const call = (inner: AnyParser): string => `${target(inner)}(c)`
    // Pure leading primitives can rule out an alternative without constructing
    // a diagnostic. If every branch fails, materialize those diagnostics in the
    // original order. Never speculate across a callback or a recovery boundary.
    const guard = (inner: AnyParser): string | undefined => {
      const plan = plans.get(inner)
      switch (plan?.kind) {
        case "literal":
          return `c.state.source.startsWith(${ref(plan.value)}, c.state.offset)`
        case "char":
          return `State.charAt(c.state) === ${ref(plan.value)}`
        case "regex": {
          const re = ref(
            new RegExp(plan.expression.source, plan.expression.flags)
          )
          return `(${re}.lastIndex = c.state.offset, ${re}.exec(c.state.source)?.index === c.state.offset)`
        }
        case "map":
        case "flatMap":
          return guard(plan.inner)
        case "zip":
        case "zipLeft":
        case "zipRight":
          return guard(plan.left)
        case "choice": {
          const alternatives = plan.alternatives.map(guard)
          return alternatives.every(test => test !== undefined)
            ? `(${alternatives.join(" || ")})`
            : undefined
        }
        default:
          return undefined
      }
    }
    call(root)
    const functions: string[] = []
    const bindings: string[] = []
    const success = "c.state = clear(c.state); return true;"
    for (let index = 0; index < queue.length; index++) {
      const inner = queue[index]!
      const plan = plans.get(inner)
      const fallback = () =>
        `return accept(c, (0, ${ref(getRunner(inner))})(c.state));`
      let body: string
      switch (plan?.kind) {
        case "literal":
        case "char": {
          const value = ref(plan.value)
          const matches =
            plan.kind === "char"
              ? `State.charAt(c.state) === ${value}`
              : `c.state.source.startsWith(${value}, c.state.offset)`
          body = `if (!(${matches})) { ${fallback()} }
            c.state = State.consume(c.state, ${plan.value.length}); c.value = ${value}; ${success}`
          break
        }
        case "regex": {
          const expression = ref(
            new RegExp(plan.expression.source, plan.expression.flags)
          )
          body = `const re = ${expression}; re.lastIndex = c.state.offset;
            const match = re.exec(c.state.source);
            if (!match || match.index !== c.state.offset) { ${fallback()} }
            const end = re.lastIndex; c.value = c.state.source.slice(c.state.offset, end);
            c.state = State.consume(c.state, end - c.state.offset); ${success}`
          break
        }
        case "satisfy":
          body = `const value = State.charAt(c.state);
            if (!value || !(0, ${ref(plan.predicate)})(value)) {
              return accept(c, (0, ${ref(plan.failure)})(c.state));
            }
            c.value = value; c.state = State.consume(c.state, value.length); ${success}`
          break
        case "takeWhile":
          body = `const start = c.state; c.state = State.consumeWhile(start, ${ref(plan.predicate)});
            c.value = start.source.slice(start.offset, c.state.offset); ${success}`
          break
        case "succeed":
          body = `c.value = ${ref(plan.value)}; ${success}`
          break
        case "map":
          body = `if (!${call(plan.inner)}) return false;
            c.value = (0, ${ref(plan.callback)})(c.value); ${success}`
          break
        case "flatMap":
          body = `if (!${call(plan.inner)}) return false;
            return dynamic((0, ${ref(plan.callback)})(c.value), c);`
          break
        case "zip":
        case "zipLeft":
        case "zipRight":
          body = `if (!${call(plan.left)}) return false;
            ${plan.kind !== "zipRight" ? "const left = c.value;" : ""}
            if (!${call(plan.right)}) return false;
            ${plan.kind === "zip" ? "c.value = [left, c.value];" : plan.kind === "zipLeft" ? "c.value = left;" : ""}
            ${plan.kind === "zipRight" ? "return true;" : success}`
          break
        case "reply":
          body = `const entry = c.state;
            const reply = ${call(plan.inner)} ? { state: c.state, result: { ok: true, value: c.value } } : c.failure;
            return accept(c, (0, ${ref(plan.transform)})(reply, entry));`
          break
        case "many":
          body = `${plan.discard ? "" : "const values = [];"}
            while (true) {
              const entry = c.state;
              if (!${call(plan.inner)}) {
                if (stopped(c, entry)) return false;
                c.state = entry; c.value = ${plan.discard ? "undefined" : "values"}; ${success}
              }
              if (c.state.offset <= entry.offset) throw new Error("repeated parser must consume input");
              ${plan.discard ? "" : "values.push(c.value);"}
            }`
          break
        case "list":
          body = `const entry = c.state;
            if (!${call(plan.inner)}) {
              ${plan.requireOne ? "return false;" : `if (stopped(c, entry)) return false; c.state = entry; c.value = []; ${success}`}
            }
            const values = [c.value];
            while (true) {
              const before = c.state;
              if (!${call(plan.separator)}) {
                if (stopped(c, before)) return false;
                c.state = before; c.value = values; ${success}
              }
              const separated = c.state;
              if (!${call(plan.inner)}) {
                ${plan.allowTrailing ? `if (stopped(c, before)) return false; c.state = separated; c.value = values; ${success}` : "return false;"}
              }
              if (c.state.offset <= separated.offset) throw new Error("list item must consume input");
              if (c.state.offset <= before.offset) throw new Error("list iteration must consume input");
              values.push(c.value);
            }`
          break
        case "choice":
          body = `const entry = c.state; const failures = [];
            ${plan.alternatives
              .map(alternative => {
                const test = guard(alternative)
                const run = `
                if (${call(alternative)}) return true;
                if (stopped(c, entry)) return false;
                failures.push(c.failure.result.failure); c.state = entry;`
                return test === undefined
                  ? run
                  : `
                if (${test}) { ${run} }
                else failures.push(${ref(getRunner(alternative))});`
              })
              .join("\n")}
            c.failure = { state: entry, result: { ok: false, failure: (0, ${ref(plan.merge)})(
              failures.map(f => typeof f === "function" ? f(entry).result.failure : f)
            ) } }; return false;`
          break
        case "generator":
          body = `return generate(${ref(plan.factory)}, c);`
          break
        case "recursive":
          // Resolve only on first use, preserving recursive builder laziness.
          body = `return ${ref(lazy(plan.get))}(c);`
          break
        case "sequence": {
          const items = ref(plan.items)
          const snapshot = ref([...plan.items])
          bindings.push(
            `const s${index} = [${plan.items.map(target).join(",")}];`
          )
          body = `const values = [];
            for (let i = 0; i < ${items}.length; i++) {
              const item = ${items}[i];
              if (!(item === ${snapshot}[i] ? s${index}[i](c) : dynamic(item, c))) return false;
              values.push(c.value);
            }
            c.value = values; ${success}`
          break
        }
        case "count":
          body = `const values = [];
            for (let i = 0; i < ${plan.count}; i++) {
              if (!${call(plan.inner)}) return false; values.push(c.value);
            }
            c.value = values; ${success}`
          break
        default:
          body = fallback()
      }
      functions.push(`function p${index}(c) { ${body} }`)
    }
    // Only fixed templates and compiler-owned numeric identifiers enter source.
    // A blocked Function constructor deliberately throws at the opt-in boundary.
    const factory = new Function(
      "r",
      "State",
      "clear",
      "accept",
      "stopped",
      "dynamic",
      "generate",
      `"use strict";\n${functions.join("\n")}\n${bindings.join("\n")}\nreturn [${queue.map((_, i) => `p${i}`).join(",")}];`
    )
    const built = factory(
      refs,
      State,
      clearContext,
      accept,
      stopped,
      dynamic,
      generate
    ) as Step[]
    queue.forEach((inner, index) => steps.set(inner, built[index]!))
    return built[0]!
  }

  const step = build(parser)
  const result = makeParser<T>(state => {
    // Per-invocation state makes callbacks reentrant and keeps failures isolated.
    const frame: Frame = { state, value: undefined, failure: undefined }
    return step(frame)
      ? ParserOutput(frame.state, { ok: true, value: frame.value as T })
      : (frame.failure! as ParserReply<T>)
  })
  compiled.set(parser, result)
  compiled.set(result, result)
  return result
}
