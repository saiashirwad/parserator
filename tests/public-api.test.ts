import { describe, expect, test } from "vitest"

describe("root public API", () => {
  test("exports the 0.2 surface without internal result machinery", async () => {
    const api = await import("../src/index")

    for (const name of [
      "Parser",
      "parser",
      "succeed",
      "fail",
      "fatal",
      "literal",
      "choice",
      "optional",
      "many",
      "commit",
      "attempt",
      "lookahead",
      "probe",
      "ParseError"
    ]) {
      expect(api).toHaveProperty(name)
    }

    for (const internal of [
      "Either",
      "Left",
      "Right",
      "ParserOutput",
      "ParserState",
      "State",
      "LazyCustomError",
      "ParseErrorBundle",
      "or",
      "atomic",
      "many0",
      "manyN",
      "manyNExact",
      "skipMany0",
      "string",
      "narrowedString"
    ]) {
      expect(api).not.toHaveProperty(internal)
    }

    // A module namespace with a `then` export is itself a thenable.
    expect(api).not.toHaveProperty("then")

    const ParserClass = api.Parser as unknown as Record<string, unknown>
    for (const helper of [
      "run",
      "succeed",
      "fail",
      "fatal",
      "lift",
      "pure",
      "lazy"
    ]) {
      expect(ParserClass).not.toHaveProperty(helper)
    }

    const parser = api.literal("x") as unknown as Record<string, unknown>
    for (const oldMethod of [
      "then",
      "run",
      "thenDiscard",
      "atomic",
      "expect",
      "label"
    ]) {
      expect(parser).not.toHaveProperty(oldMethod)
    }
  })

  test("keeps low-level and diagnostic APIs in their subpaths", async () => {
    const advanced = await import("../src/advanced")
    expect(advanced).toHaveProperty("makeParser")
    expect(advanced).toHaveProperty("State")
    expect(advanced).toHaveProperty("ParserOutput")

    const diagnostics = await import("../src/diagnostics")
    expect(diagnostics).toHaveProperty("ParseError")
    expect(diagnostics).toHaveProperty("SourceText")
    expect(diagnostics).toHaveProperty("formatError")
  })
})
