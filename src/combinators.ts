import { Either } from "./either"
import { Parser } from "./parser"
import type { ParseErrorBundle } from "./rich-errors"
import { type ParserState, State } from "./state"

/**
 * Creates a parser that looks ahead in the input stream without consuming any input.
 * The parser will succeed with the result of the given parser but won't advance the input position.
 *
 * @param parser - The parser to look ahead with
 * @returns A new parser that peeks at the input without consuming it
 * ```ts
 * const parser = lookAhead(char('a'))
 * parser.run('abc') // Right(['a', {...}])
 * // Input position remains at 'abc', 'a' is not consumed
 * ```
 */
export function lookAhead<T, Ctx = {}>(
  parser: Parser<T, Ctx>
): Parser<T | undefined, Ctx> {
  return new Parser(state => {
    const { result } = parser.run(state)
    if (Either.isRight(result)) {
      return Parser.succeed(result.right, state)
    }
    return Parser.succeed(undefined, state)
  })
}

/**
 * Creates a parser that succeeds only if the given parser fails to match.
 * If the parser succeeds, this parser fails with an error message.
 *
 * @param parser - The parser that should not match
 * @returns A new parser that succeeds only if the input parser fails
 * ```ts
 * const notA = notFollowedBy(char('a'))
 * notA.run('bcd') // Right([true, {...}]) - Succeeds because 'a' is not found
 * notA.run('abc') // Left(error) - Fails because 'a' is found
 * ```
 */
export function notFollowedBy<T, Ctx = {}>(
  parser: Parser<T, Ctx>
): Parser<boolean, Ctx> {
  return new Parser(state => {
    const { result, state: newState } = parser.run(state)
    if (Either.isRight(result)) {
      if (parser.options?.name) {
        const message = `Found ${parser.options.name} when it should not appear here`
        return Parser.fail({ message, expected: [] }, newState)
      }
      return Parser.fail(
        {
          message: "Expected not to follow",
          expected: [],
          found: state.remaining.at(0)
        },
        newState
      )
    }
    return Parser.succeed(true, state)
  })
}

/**
 * Creates a parser that matches an exact string in the input.
 *
 * @param str - The string to match
 * @returns A parser that matches and consumes the exact string
 * ```ts
 * const parser = string("hello")
 * parser.run("hello world") // Right(["hello", {...}])
 * parser.run("goodbye") // Left(error)
 * ```
 */
export const string = <Ctx = {}>(str: string): Parser<string, Ctx> =>
  new Parser(
    state => {
      if (state.remaining.startsWith(str)) {
        return Parser.succeed(str, State.consume(state, str.length))
      }

      const message =
        `Expected '${str}', ` +
        `but found '${state.remaining.slice(0, str.length)}'`

      return Parser.fail(
        {
          message,
          expected: [str],
          found: state.remaining.slice(0, str.length)
        },
        state
      )
    },
    { name: str }
  )

/**
 * Creates a parser that matches an exact string literal type.
 * Similar to string parser but preserves the literal type information.
 *
 * @param str - The string literal to match
 * @returns A parser that matches and consumes the exact string with preserved type
 * ```ts
 * const parser = narrowedString("hello") // Parser<"hello">
 * parser.run("hello world") // Right(["hello", {...}])
 * parser.run("goodbye") // Left(error)
 * ```
 */
export function narrowedString<const T extends string, Ctx>(
  str: T
): Parser<T, Ctx> {
  return string(str) as any
}

/**
 * Creates a parser that matches a single character.
 *
 * @param ch - The character to match
 * @returns A parser that matches and consumes a single character
 * ```ts
 * const parser = char("a")
 * parser.run("abc") // Right(["a", {...}])
 * parser.run("xyz") // Left(error)
 * ```
 */
export const char = <T extends string, Ctx = {}>(ch: T): Parser<T, Ctx> => {
  return new Parser(
    state => {
      if (ch.length !== 1) {
        return Parser.fail(
          { message: "Incorrect usage of char parser.", expected: [ch] },
          state
        )
      }
      if (state.remaining[0] === ch) {
        return Parser.succeed(ch, State.consume(state, 1))
      }

      const message = `Expected ${ch} but found ${state.remaining.at(0)}.`
      return Parser.fail(
        { message, expected: [ch], found: state.remaining.at(0) },
        state
      )
    },
    { name: ch }
  )
}

/**
 * A parser that matches any single alphabetic character (a-z, A-Z).
 *
 * ```ts
 * const parser = alphabet
 * parser.run("abc") // Right(["a", {...}])
 * parser.run("123") // Left(error)
 * ```
 */
export const alphabet = new Parser(
  state => {
    if (State.isAtEnd(state)) {
      return Parser.fail(
        { message: "Unexpected end of input", expected: [] },
        state
      )
    }
    const first = state.remaining[0]
    if (first && /^[a-zA-Z]$/.test(first)) {
      return Parser.succeed(first, State.consume(state, 1))
    }
    const message = `Expected alphabetic character, but got '${first}'`
    return Parser.fail(
      { message, expected: [], found: state.remaining[0] },
      state
    )
  },
  { name: "alphabet" }
)

/**
 * A parser that matches any single digit character (0-9).
 *
 * ```ts
 * const parser = digit
 * parser.run("123") // Right(["1", {...}])
 * parser.run("abc") // Left(error)
 * ```
 */
export const digit = new Parser(
  state => {
    if (State.isAtEnd(state)) {
      return Parser.fail(
        { message: "Unexpected end of input", expected: [] },
        state
      )
    }
    const first = state.remaining[0]
    if (first && /^[0-9]$/.test(first)) {
      return Parser.succeed(first, State.consume(state, 1))
    }
    const message = `Expected digit, but got '${first}'`
    return Parser.fail(
      { message, expected: [], found: state.remaining[0] },
      state
    )
  },
  { name: "digit" }
)

/**
 * Creates a parser that matches zero or more occurrences of elements separated by a separator.
 *
 * @param sepParser - Parser for the separator between elements
 * @param parser - Parser for the elements
 * @returns A parser that produces an array of matched elements
 *
 * ```ts
 * const parser = sepBy(char(','), digit)
 * parser.run("1,2,3") // Right([["1", "2", "3"], {...}])
 * parser.run("") // Right([[], {...}])
 * ```
 */
// TODO: fix this
export function sepBy<S, T, Ctx>(
  sepParser: Parser<S, Ctx>,
  parser: Parser<T, Ctx>
): Parser<T[], Ctx> {
  return new Parser(state => {
    const results: T[] = []
    let currentState = state

    const { result: firstResult, state: firstState } = parser.run(currentState)
    if (Either.isLeft(firstResult)) {
      return Parser.succeed([], state)
    }

    results.push(firstResult.right)
    currentState = firstState

    while (true) {
      const { result: sepResult, state: sepState } = sepParser.run(currentState)
      if (Either.isLeft(sepResult)) {
        break
      }
      currentState = sepState

      const { result: itemResult, state: itemResultState } =
        parser.run(currentState)
      if (Either.isLeft(itemResult)) {
        return {
          result: itemResult as unknown as Either<T[], ParseErrorBundle>,
          state: itemResultState
        }
      }
      results.push(itemResult.right)
      currentState = itemResultState
    }

    return Parser.succeed(results, currentState)
  })
}

/**
 * Creates a parser that matches content between two string delimiters.
 *
 * @param start - The opening delimiter string
 * @param end - The closing delimiter string
 * @param parser - The parser for the content between delimiters
 * @returns A parser that matches content between delimiters
 *
 * ```ts
 * const parser = between('(', ')', digit)
 * parser.run('(5)') // Right(['5', {...}])
 * parser.run('5') // Left(error)
 * ```
 */
export function between<T, Ctx = {}>(
  start: Parser<any, Ctx>,
  end: Parser<any, Ctx>,
  parser: Parser<T, Ctx>
): Parser<any, Ctx> {
  return new Parser(state => {
    // Parse opening delimiter
    const startResult = start.run(state)
    if (Either.isLeft(startResult.result)) {
      return startResult
    }

    // Parse content
    const contentResult = parser.run(startResult.state)
    if (Either.isLeft(contentResult.result)) {
      return contentResult
    }

    // Parse closing delimiter
    const endResult = end.run(contentResult.state)
    if (Either.isLeft(endResult.result)) {
      return endResult
    }

    // Return the content and final state
    return Parser.succeed(contentResult.result.right, endResult.state)
  })
}

export function anyChar<Ctx = {}>() {
  return new Parser<string, Ctx>(state => {
    if (State.isAtEnd(state)) {
      return Parser.fail(
        { message: "Unexpected end of input", expected: [] },
        state
      )
    }
    return Parser.succeed(state.remaining[0], State.consume(state, 1))
  })
}

/**
 * Internal helper function for creating repetition parsers.
 *
 * @param count - Minimum number of repetitions required
 * @returns A function that creates a parser matching multiple occurrences
 */
function many_<S, T, Ctx = {}>(count: number) {
  return (
    parser: Parser<T, Ctx>,
    separator?: Parser<S, Ctx>
  ): Parser<T[], Ctx> => {
    return new Parser(state => {
      const results: T[] = []
      let currentState = state

      while (true) {
        // Try to parse the next item
        const itemResult = parser.run(currentState)
        if (Either.isLeft(itemResult.result)) {
          // If we have enough items, return success
          if (results.length >= count) {
            return Parser.succeed(results, currentState)
          }
          const message = `Expected at least ${count} occurrences, but only found ${results.length}`
          return Parser.fail({ message, expected: [] }, itemResult.state)
        }

        // Add the item and update state
        const { result: value, state: newState } = itemResult
        results.push(value.right)

        // Check that parser advanced - prevent infinite loops
        if (newState.pos.offset <= currentState.pos.offset) {
          throw new Error("Parser did not advance - infinite loop prevented")
        }
        currentState = newState as ParserState<Ctx>

        // If we have a separator, try to parse it
        if (separator) {
          const { result: sepResult, state } = separator.run(currentState)
          if (Either.isLeft(sepResult)) {
            break
          }
          // Check that separator advanced too
          if (state.pos.offset <= currentState.pos.offset) {
            throw new Error(
              "Separator parser did not advance - infinite loop prevented"
            )
          }
          currentState = state as ParserState<Ctx>
        }
      }

      if (results.length >= count) {
        return Parser.succeed(results, currentState)
      }

      const message = `Expected at least ${count} occurrences, but only found ${results.length}`
      return Parser.fail({ message, expected: [] }, currentState)
    })
  }
}

/**
 * Creates a parser that matches zero or more occurrences of the input parser.
 *
 * @param parser - The parser to repeat
 * @returns A parser that produces an array of all matches
 */
export const many0 = <S, T, Ctx = {}>(
  parser: Parser<T, Ctx>,
  separator?: Parser<S, Ctx>
) => many_<S, T, Ctx>(0)(parser, separator)

/**
 * Creates a parser that matches one or more occurrences of the input parser.
 *
 * @param parser - The parser to repeat
 * @returns A parser that produces an array of all matches (at least one)
 */
export const many1 = <S, T, Ctx>(
  parser: Parser<T, Ctx>,
  separator?: Parser<S, Ctx>
) => many_<S, T, Ctx>(1)(parser, separator)

/**
 * Creates a parser that matches at least n occurrences of the input parser.
 *
 * @param parser - The parser to repeat
 * @param n - Number of required repetitions
 * @returns A parser that produces an array of at least n matches
 */
export const manyN = <S, T, Ctx>(
  parser: Parser<T, Ctx>,
  n: number,
  separator?: Parser<S, Ctx>
) => many_<S, T, Ctx>(n)(parser, separator)

/**
 * Creates a parser that matches exactly n occurrences of the input parser.
 *
 * @param parser - The parser to repeat
 * @param n - Number of required repetitions
 * @param separator - Optional parser to match between occurrences
 * @returns A parser that produces an array of exactly n matches
 */

export const manyNExact = <S, T, Ctx>(
  parser: Parser<T, Ctx>,
  n: number,
  separator?: Parser<S, Ctx>
) =>
  Parser.gen(function* () {
    const results = yield* manyN(parser, n, separator)
    if (results.length !== n) {
      const message = `Expected exactly ${n} occurrences, but found ${results.length}`
      return yield* Parser.error<Ctx>(message)
    }
    return results
  })

/**
 * Internal helper function for creating skipping repetition parsers.
 *
 * @param count - Minimum number of repetitions required
 * @returns A function that creates a parser skipping multiple occurrences
 */
function skipMany_<T, Ctx>(count: number) {
  return (parser: Parser<T, Ctx>): Parser<undefined, Ctx> => {
    return new Parser(state => {
      let currentState = state
      let successes = 0

      while (true) {
        const { result, state: newState } = parser.run(currentState)
        if (Either.isLeft(result)) {
          break
        }

        // Check that parser advanced - prevent infinite loops
        if (newState.pos.offset <= currentState.pos.offset) {
          throw new Error("Parser did not advance - infinite loop prevented")
        }

        successes++
        currentState = newState as ParserState<Ctx>
      }

      if (successes >= count) {
        return Parser.succeed(undefined, currentState)
      }
      const message = `Expected at least ${count} occurrences, but only found ${successes}`
      return Parser.fail({ message, expected: [] }, state)
    })
  }
}

/**
 * Creates a parser that skips zero or more occurrences of the input parser.
 *
 * @param parser - The parser to skip
 * @returns A parser that skips all matches
 */
export const skipMany0 = <T, Ctx = {}>(parser: Parser<T, Ctx>) =>
  skipMany_<T, Ctx>(0)(parser)

/**
 * Creates a parser that skips one or more occurrences of the input parser.
 *
 * @param parser - The parser to skip
 * @returns A parser that skips all matches (requires at least one)
 */
export const skipMany1 = <T, Ctx>(parser: Parser<T, Ctx>) =>
  skipMany_<T, Ctx>(1)(parser)

/**
 * Creates a parser that skips exactly n occurrences of the input parser.
 *
 * @param parser - The parser to skip
 * @param n - Number of required repetitions to skip
 * @returns A parser that skips exactly n matches
 */
export const skipManyN = <T, Ctx>(parser: Parser<T, Ctx>, n: number) =>
  skipMany_<T, Ctx>(n)(parser)

/**
 * Creates a parser that skips input until the given parser succeeds.
 *
 * @param parser - The parser to look for
 * @returns A parser that skips input until a match is found
 */
export function skipUntil<T, Ctx = {}>(
  parser: Parser<T, Ctx>
): Parser<undefined, Ctx> {
  return new Parser(state => {
    let currentState = state

    while (!State.isAtEnd(currentState)) {
      const { result, state: newState } = parser.run(currentState)
      if (Either.isRight(result)) {
        return Parser.succeed(undefined, newState)
      }
      currentState = State.consume(currentState, 1)
    }

    return Parser.succeed(undefined, currentState)
  })
}

/**
 * Creates a parser that takes input until the given parser succeeds.
 *
 * @param parser - The parser to look for
 * @returns A parser that takes input until a match is found
 */
export function takeUntil<T, Ctx = {}>(
  parser: Parser<T, Ctx>
): Parser<string, Ctx> {
  return new Parser(state => {
    let currentState = state
    let collected = ""

    while (!State.isAtEnd(currentState)) {
      const { result, state: newState } = parser.run(currentState)
      if (Either.isRight(result)) {
        return Parser.succeed(collected, newState)
      }
      collected += currentState.remaining[0]
      currentState = State.consume(currentState, 1)
    }

    return Parser.succeed(collected, currentState)
  })
}

/**
 * Creates a parser that takes input until the given character is found.
 *
 * @param char - The character to look for
 * @returns A parser that takes input until the character is found
 */
export function parseUntilChar<Ctx = {}>(char: string): Parser<string, Ctx> {
  return new Parser(state => {
    if (char.length !== 1) {
      return Parser.fail(
        {
          message: "Incorrect usage of parseUntilChar parser.",
          expected: [char]
        },
        state
      )
    }
    let currentState = state
    let collected = ""

    while (!State.isAtEnd(currentState)) {
      if (currentState.remaining[0] === char) {
        return Parser.succeed(collected, currentState)
      }
      collected += currentState.remaining[0]
      currentState = State.consume(currentState, 1)
    }

    const message = `Expected character ${char} but found ${collected}`
    return Parser.fail({ message, expected: [char] }, currentState)
  })
}

/**
 * A parser that skips any number of space characters.
 */
export const skipSpaces = new Parser(
  state =>
    Parser.succeed(
      undefined,
      State.consumeWhile(state, char => char === " ")
    ),
  { name: "skipSpaces" }
)

/**
 * Creates a parser that tries multiple parsers in order until one succeeds.
 *
 * @param parsers - Array of parsers to try
 * @returns A parser that succeeds if any of the input parsers succeed
 */
export function or<Parsers extends Parser<any, any>[], Ctx = {}>(
  ...parsers: Parsers
): Parser<Parsers[number] extends Parser<infer T, Ctx> ? T : never, Ctx> {
  return new Parser(state => {
    // const expectedNames: string[] = []
    for (const parser of parsers) {
      const { result, state: newState } = parser.run(state)
      if (Either.isRight(result)) {
        return Parser.succeed(result.right, newState)
      }
      // if (parser.options?.name) {
      // 	expectedNames.push(parser.options.name)
      // }
    }

    const message = `None of the ${parsers.length} choices could be satisfied`
    return Parser.fail({ message }, state)
  })
}

/**
 * Creates a parser that optionally matches the input parser.
 * If the parser fails, returns undefined without consuming input.
 *
 * @param parser - The parser to make optional
 * @returns A parser that either succeeds with a value or undefined
 */
export function optional<T, Ctx = {}>(parser: Parser<T, Ctx>) {
  return new Parser((state: ParserState<Ctx>) => {
    const { result, state: newState } = parser.run(state)
    if (Either.isLeft(result)) {
      return Parser.succeed(undefined, state)
    }
    // return result
    return Parser.succeed(result.right, newState)
  })
}

type LastParser<T, Ctx = {}> =
  T extends [...any[], Parser<infer L, Ctx>] ? L : never

/**
 * Creates a parser that runs multiple parsers in sequence.
 * Returns the result of the last parser in the sequence.
 *
 * @param parsers - Array of parsers to run in sequence
 * @returns A parser that succeeds if all parsers succeed in sequence
 */
export function sequence<Parsers extends Parser<any>[], Ctx = {}>(
  parsers: [...Parsers]
): Parser<LastParser<Parsers, Ctx>, Ctx> {
  return new Parser((state: ParserState<Ctx>) => {
    let currentState = state
    let lastResult: any

    for (const parser of parsers) {
      const { result, state: newState } = parser.run(currentState)
      if (Either.isLeft(result)) {
        return {
          result: result as unknown as Either<
            LastParser<Parsers, Ctx>,
            ParseErrorBundle
          >,
          state: newState
        }
      }
      lastResult = result.right
      currentState = newState as ParserState<Ctx>
    }

    return Parser.succeed(lastResult, currentState) as any
  })
}

/**
 * Creates a parser that matches input against a regular expression.
 * The regex must match at the start of the input.
 *
 * @param re - The regular expression to match against
 * @returns A parser that matches the regex pattern
 */
export const regex = <Ctx = {}>(re: RegExp): Parser<string, Ctx> => {
  // Create a new RegExp without global flag to ensure consistent behavior
  const nonGlobalRe = new RegExp(re.source, re.flags.replace("g", ""))

  return new Parser(
    state => {
      const match = nonGlobalRe.exec(state.remaining)
      if (match && match.index === 0) {
        const value = match[0]
        return Parser.succeed(value, State.consume<Ctx>(state, value.length))
      }
      const message = `Expected ${re} but found ${state.remaining.slice(0, 10)}...`
      return Parser.fail(
        {
          message,
          expected: [re.toString()]
        },
        state
      )
    },
    { name: re.toString() }
  )
}

export function zip<A, B>(
  parserA: Parser<A>,
  parserB: Parser<B>
): Parser<[A, B]> {
  return parserA.zip(parserB)
}

export function then<A, B>(parserA: Parser<A>, parserB: Parser<B>): Parser<B> {
  return parserA.then(parserB)
}

export const zipRight = then

export function thenDiscard<A, B>(
  parserA: Parser<A>,
  parserB: Parser<B>
): Parser<A> {
  return parserA.thenDiscard(parserB)
}
export const zipLeft = thenDiscard

/**
 * Creates a parser that takes input until the given parser would succeed, without consuming the parser.
 *
 * @param parser - The parser to look for
 * @returns A parser that takes input until before a match would be found
 */
export function takeUpto<T>(parser: Parser<T>): Parser<string> {
  return new Parser(state => {
    let currentState = state
    let collected = ""

    while (!State.isAtEnd(currentState)) {
      const { result } = parser.run(currentState)
      if (Either.isRight(result)) {
        return Parser.succeed(collected, currentState)
      }
      collected += currentState.remaining[0]
      currentState = State.consume(currentState, 1)
    }

    return Parser.succeed(collected, currentState)
  })
}
