/** Input delivery and lifetime management, independent of grammar execution. */
import type {
  CoreParser,
  CoreReply,
  CoreState,
  IncrementalInput,
  IncrementalParser,
  IncrementalResult,
  InputAdapter
} from "./core.ts"

type Execution<T, I> = Generator<void, CoreReply<T, I>, void>
type Run<T, I, E extends Error> = (
  parser: CoreParser<T, I, E>,
  state: CoreState<I>
) => Execution<T, I>

/** Seeded input is already owned by the stream, so draining a chunk needs no copies. */
export function createSession<T, I, E extends Error>(
  grammar: CoreParser<T, I, E>,
  adapter: InputAdapter<I, E>,
  run: Run<T, I, E>,
  options: { readonly sourceName?: string },
  initial?: I
): [IncrementalParser<T, I, E>, () => IncrementalResult<T, I, E>] {
  if (!adapter.incrementalInput)
    throw new TypeError(
      "This input adapter does not support incremental parsing"
    )
  let input: IncrementalInput<I> | undefined = adapter.incrementalInput(initial)
  function* start(): Execution<T, I> {
    return yield* run(grammar, { ...adapter.fromInput(input!.source), input })
  }
  let execution: Execution<T, I> | undefined = start()
  let running = false
  const checkOpen = () => {
    if (running) throw new Error("An incremental parser cannot be reentered")
    if (!execution) throw new Error("Incremental parser is closed")
  }
  const close = () => {
    const current = execution
    execution = undefined
    input = undefined
    current?.return(undefined as never)
  }
  const step = (): IncrementalResult<T, I, E> => {
    running = true
    try {
      const next = execution!.next()
      if (!next.done) {
        if (input!.final)
          throw new Error("Parser requested input after end-of-input")
        return { status: "needMore" }
      }
      const reply = next.value
      if (!reply.result.ok)
        return {
          status: "error",
          error: adapter.error(
            reply.result.failure.diagnostic,
            reply.state.source,
            options.sourceName
          )
        }
      return {
        status: "done",
        value: reply.result.value,
        offset: reply.state.offset,
        rest: adapter.remaining(reply.state)
      }
    } catch (error) {
      close()
      throw error
    } finally {
      running = false
    }
  }
  const advance = () => {
    const result = step()
    if (result.status !== "needMore") close()
    return result
  }
  const session: IncrementalParser<T, I, E> = {
    push(chunk) {
      checkOpen()
      input!.append(chunk)
      return advance()
    },
    finish() {
      checkOpen()
      input!.final = true
      return advance()
    },
    cancel() {
      if (running) throw new Error("An incremental parser cannot be reentered")
      close()
    }
  }
  return [session, advance]
}

/** Repeat a consuming prefix grammar, retaining only the active message input. */
export async function* parseStream<T, I, E extends Error>(
  grammar: CoreParser<T, I, E>,
  adapter: InputAdapter<I, E>,
  run: Run<T, I, E>,
  chunks: AsyncIterable<I> | Iterable<I>,
  options: { readonly sourceName?: string }
): AsyncGenerator<Awaited<T>, void, unknown> {
  const startSession = (initial?: I) =>
    createSession(grammar, adapter, run, options, initial)
  let session: IncrementalParser<T, I, E> | undefined
  const empty = (chunk: I) => adapter.isAtEnd(adapter.fromInput(chunk))
  function* drain(
    result: IncrementalResult<T, I, E>,
    final: boolean
  ): Generator<T> {
    while (true) {
      if (result.status === "needMore") {
        if (!final) return
        result = session!.finish()
        continue
      }
      if (result.status === "error") throw result.error
      if (result.offset <= 0)
        throw new Error("stream parser must consume input")
      session = undefined
      yield result.value
      if (empty(result.rest)) return
      const next = startSession(result.rest)
      session = next[0]
      result = next[1]()
    }
  }
  try {
    for await (const chunk of chunks) {
      if (empty(chunk)) continue
      session ??= createSession(grammar, adapter, run, options)[0]
      yield* drain(session.push(chunk), false)
    }
    if (session) yield* drain(session.finish(), true)
  } finally {
    session?.cancel()
  }
}
