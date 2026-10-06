import { expect, test, vi } from "vitest"
import { commit, fail, fatal, parser, succeed } from "../src/index.ts"

const callbackError = new Error("callback failed")
const exits = [
  ["ordinary failure", fail("stop")],
  ["cut failure", commit().zipRight(fail("stop"))],
  ["fatal failure", fatal("stop")],
  [
    "callback throw",
    succeed(undefined).map(() => {
      throw callbackError
    })
  ]
] as const

test.each(exits)(
  "%s finishes yielding finalizers without executing cleanup parsers",
  (name, exit) => {
    const events: string[] = []
    const cleanup = vi.fn()
    const skipped = succeed(undefined).map(cleanup)
    const inner = parser(function* () {
      try {
        try {
          yield* exit
        } finally {
          try {
            events.push("inner cleanup entered")
            yield* skipped
            events.push("inner resumed after cancellation")
          } finally {
            try {
              events.push("inner resource released")
              yield* skipped
            } finally {
              events.push("inner outer resource released")
            }
          }
        }
      } finally {
        events.push("inner finalizer finished")
      }
    })
    const outer = parser(function* () {
      try {
        yield* inner
      } finally {
        try {
          events.push("outer cleanup entered")
          yield* skipped
        } finally {
          events.push("outer resource released")
        }
      }
    })
    if (name === "callback throw") {
      let caught: unknown
      try {
        outer.parse("")
      } catch (error) {
        caught = error
      }
      expect(caught).toBe(callbackError)
    } else {
      const result = outer.parse("")
      expect(result.success).toBe(false)
      if (result.success) throw new Error("expected failure")
      expect(result.error.fatal).toBe(name === "fatal failure")
      expect(result.error.diagnostic).toMatchObject({
        kind: "custom",
        message: "stop"
      })
    }
    expect(events).toEqual([
      "inner cleanup entered",
      "inner resource released",
      "inner outer resource released",
      "inner finalizer finished",
      "outer cleanup entered",
      "outer resource released"
    ])
    expect(cleanup).not.toHaveBeenCalled()
  }
)

test.each(exits)(
  "cleanup throws once and still releases outer resources after %s",
  (_name, exit) => {
    const cleanupError = new Error("cleanup failed")
    const release = vi.fn()
    const throwCleanup = vi.fn(() => {
      throw cleanupError
    })
    const skipped = vi.fn()
    const grammar = parser(function* () {
      try {
        try {
          yield* exit
        } finally {
          try {
            yield* succeed(undefined).map(skipped)
          } finally {
            throwCleanup()
          }
        }
      } finally {
        release()
      }
    })
    let caught: unknown
    try {
      grammar.parse("")
    } catch (error) {
      caught = error
    }
    expect(caught).toBe(cleanupError)
    expect(throwCleanup).toHaveBeenCalledTimes(1)
    expect(release).toHaveBeenCalledTimes(1)
    expect(skipped).not.toHaveBeenCalled()
  }
)

test("normal completion executes finally yields and resumes with their values", () => {
  const events: string[] = []
  const grammar = parser(function* () {
    let value = yield* succeed(2)
    try {
      value += yield* succeed(3)
    } finally {
      try {
        events.push("cleanup entered")
        value += yield* succeed(4).map(n => {
          events.push("cleanup parser ran")
          return n
        })
        events.push("cleanup resumed")
      } finally {
        events.push("resource released")
      }
    }
    return value
  })
  expect(grammar.parseOrThrow("")).toBe(9)
  expect(events).toEqual([
    "cleanup entered",
    "cleanup parser ran",
    "cleanup resumed",
    "resource released"
  ])
})
