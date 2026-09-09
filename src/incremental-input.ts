import type { IncrementalInput } from "./core.ts"

export function textInput(initial = ""): IncrementalInput<string> {
  let source = initial
  return {
    get source() {
      return source
    },
    final: false,
    append(chunk) {
      if (typeof chunk !== "string")
        throw new TypeError("Text parsers expect a string")
      source += chunk
    }
  }
}

/** Grow geometrically; append never overwrites bytes exposed by previous reads. */
export function byteInput(
  initial: Uint8Array = new Uint8Array(0)
): IncrementalInput<Uint8Array> {
  let storage: Uint8Array = initial
  let length = initial.length
  let source = initial
  return {
    get source() {
      return source
    },
    final: false,
    append(chunk) {
      if (!(chunk instanceof Uint8Array))
        throw new TypeError("Binary parsers expect a Uint8Array")
      const required = length + chunk.length
      if (required > storage.length) {
        const grown = new Uint8Array(
          Math.max(required, storage.length * 2, 256)
        )
        grown.set(storage.subarray(0, length))
        storage = grown
      }
      storage.set(chunk, length)
      length = required
      source = storage.subarray(0, length)
    }
  }
}
