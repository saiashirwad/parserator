import { Either } from "./either.ts"
import { type ParseError } from "./errors.ts"
import { Parser, parser } from "./parser.ts"
import { ParserOutput, State, type SourcePosition } from "./state.ts"

const isDigit = (ch: string) => ch >= "0" && ch <= "9"
const isAlphabet = (ch: string) =>
  (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")
const isAlphanumeric = (ch: string) => isAlphabet(ch) || isDigit(ch)
const isWhitespace = (ch: string) =>
  ch === " " || ch === "\t" || ch === "\n" || ch === "\r"

/**
 * Creates a parser that looks ahead in the input stream without consuming any input.
 * The parser will succeed with the result of the given parser but won't advance the input position.
 *
 * @param par - The parser to look ahead with
 * @returns {Parser<T | undefined>} A new parser that peeks at the input without consuming it
 * ```ts
 * const parser = lookahead(char('a'))
 * parser.run('abc') // Right(['a', {...}])
 * // Input position remains at 'abc', 'a' is not consumed
 * ```
 */
export const lookahead = <T>(par: Parser<T>): Parser<T | undefined> =>
  optional(atomic(par))

/**
 * Creates a parser that succeeds only if the given parser fails to match.
 * If the parser succeeds, this parser fails with an error message.
 *
 * @param par - The parser that should not match
 * @returns {Parser<boolean>} A new parser that succeeds only if the input parser fails
 * ```ts
 * const notA = notFollowedBy(char('a'))
 * notA.run('bcd') // Right([true, {...}]) - Succeeds because 'a' is not found
 * notA.run('abc') // Left(error) - Fails because 'a' is found
 * ```
 */
export function notFollowedBy<T>(par: Parser<T>): Parser<boolean> {
  return new Parser(state => {
    const { result, state: newState } = par.run(state)
    if (result._tag === "Right") {
      return Parser.fail(
        {
          message: "Expected not to follow",
          expected: [],
          found: State.charAt(state)
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
 * @returns {Parser<string>} A parser that matches and consumes the exact string
 * ```ts
 * const parser = string("hello")
 * parser.run("hello world") // Right(["hello", {...}])
 * parser.run("goodbye") // Left(error)
 * ```
 */
export const string = (str: string): Parser<string> =>
  new Parser(state => {
    if (State.startsWith(state, str)) {
      return Parser.succeed(str, State.consume(state, str.length))
    }

    const found = State.peek(state, str.length)
    return Parser.fail(
      {
        message: `Expected '${str}', but found '${found}'`,
        expected: [str],
        found
      },
      state
    )
  })

/**
 * Creates a parser that matches an exact string literal type.
 * Similar to string parser but preserves the literal type information.
 *
 * @param str - The string literal to match
 * @returns {Parser<T>} A parser that matches and consumes the exact string with preserved type
 * ```ts
 * const parser = narrowedString("hello") // Parser<"hello">
 * ```
 */
export const narrowedString = <const T extends string>(str: T): Parser<T> =>
  string(str) as Parser<T>

/**
 * Creates a parser that matches a single character.
 *
 * @param ch - The character to match
 * @returns {Parser<T>} A parser that matches and consumes a single character
 * ```ts
 * const parser = char("a")
 * parser.run("abc") // Right(["a", {...}])
 * parser.run("xyz") // Left(error)
 * ```
 */
export const char = <T extends string>(ch: T): Parser<T> => {
  if (ch.length !== 1) {
    throw new Error("char expects a single character")
  }
  return new Parser(state => {
    const found = State.charAt(state)
    if (found === ch) {
      return Parser.succeed(ch, State.consume(state, 1))
    }

    return Parser.fail(
      {
        message: `Expected '${ch}'${found ? `, but found '${found}'` : ""}`,
        expected: [ch],
        found
      },
      state
    )
  })
}

/**
 * A parser that matches any single alphabetic character (a-z, A-Z).
 *
 * ```ts
 * alphabet.run("abc") // Right(["a", {...}])
 * alphabet.run("123") // Left(error)
 * ```
 */
export const alphabet = new Parser<string>(state => {
  const first = State.charAt(state)
  if (isAlphabet(first)) {
    return Parser.succeed(first, State.consume(state, 1))
  }
  if (!first) {
    return Parser.fail(
      { message: "Unexpected end of input", expected: ["letter"] },
      state
    )
  }
  return Parser.fail(
    {
      message: `Expected alphabetic character, but got '${first}'`,
      expected: ["letter"],
      found: first
    },
    state
  )
})

/**
 * A parser that matches any single digit character (0-9).
 *
 * ```ts
 * digit.run("123") // Right(["1", {...}])
 * digit.run("abc") // Left(error)
 * ```
 */
export const digit = new Parser<string>(state => {
  const first = State.charAt(state)
  if (isDigit(first)) {
    return Parser.succeed(first, State.consume(state, 1))
  }
  if (!first) {
    return Parser.fail(
      { message: "Unexpected end of input", expected: ["digit"] },
      state
    )
  }
  return Parser.fail(
    {
      message: `Expected digit, but got '${first}'`,
      expected: ["digit"],
      found: first
    },
    state
  )
})

/**
 * A parser that matches any single character.
 *
 * @returns {Parser<string>} A parser that matches any single character
 */
export function anyChar(): Parser<string> {
  return new Parser<string>(state => {
    if (State.isAtEnd(state)) {
      return Parser.fail(
        { message: "Unexpected end of input", expected: [] },
        state
      )
    }
    return Parser.succeed(State.charAt(state), State.consume(state, 1))
  })
}

/**
 * Parses any character except the specified one.
 *
 * @param ch - The character to exclude
 * @returns {Parser<string>} A parser that matches any character except the specified one
 *
 * @example
 * ```ts
 * const notQuote = notChar('"')
 * notQuote.parse('a') // Success: 'a'
 * notQuote.parse('"') // Error: Expected any character except '"'
 * ```
 */
export function notChar(ch: string): Parser<string> {
  if (ch.length !== 1) {
    throw new Error("notChar expects a single character")
  }
  return new Parser(state => {
    const found = State.charAt(state)
    if (found && found !== ch) {
      return Parser.succeed(found, State.consume(state, 1))
    }
    return Parser.fail(
      {
        message: `Expected any character except '${ch}'`,
        expected: [`not '${ch}'`],
        found
      },
      state
    )
  })
}

/**
 * Creates a parser that matches a single character from the given set.
 *
 * @param chars - A string containing every acceptable character
 * @returns {Parser<string>} A parser that matches one of the characters
 *
 * @example
 * ```ts
 * const sign = oneOfChars("+-")
 * sign.parse("+") // Success: "+"
 * sign.parse("*") // Error
 * ```
 */
export function oneOfChars(chars: string): Parser<string> {
  if (chars.length === 0) {
    throw new Error("oneOfChars requires at least one character")
  }
  return new Parser(state => {
    const ch = State.charAt(state)
    if (ch && chars.includes(ch)) {
      return Parser.succeed(ch, State.consume(state, 1))
    }
    return Parser.fail(
      {
        message: `Expected one of: ${chars}`,
        expected: chars.split(""),
        found: ch
      },
      state
    )
  })
}

/**
 * Creates a parser that matches any of the given strings, preferring longer matches.
 *
 * @param strings - The strings to match
 * @returns {Parser<string>} A parser that matches the first (longest) matching string
 *
 * @example
 * ```ts
 * const keyword = anyOfStrings("let", "letrec")
 * keyword.parse("letrec") // Success: "letrec"
 * ```
 */
export function anyOfStrings(...strings: string[]): Parser<string> {
  const sorted = [...strings].sort((a, b) => b.length - a.length)
  return new Parser(state => {
    for (const str of sorted) {
      if (State.startsWith(state, str)) {
        return Parser.succeed(str, State.consume(state, str.length))
      }
    }
    return Parser.fail(
      {
        message: `Expected one of: ${strings.join(", ")}`,
        expected: strings
      },
      state
    )
  })
}

/**
 * Creates a parser that consumes characters while the predicate holds and
 * returns them as a string. Always succeeds (possibly with an empty string).
 *
 * @param predicate - Function that tests each character
 * @returns {Parser<string>} A parser producing the matched characters
 */
export function takeWhileChar(
  predicate: (ch: string) => boolean
): Parser<string> {
  return new Parser(state => {
    const newState = State.consumeWhile(state, predicate)
    return Parser.succeed(
      state.source.slice(state.offset, newState.offset),
      newState
    )
  })
}

/**
 * Like {@link takeWhileChar}, but fails unless at least one character matches.
 *
 * @param predicate - Function that tests each character
 * @param expected - Human-readable name of what is expected (used in errors)
 * @returns {Parser<string>} A parser producing the matched characters
 */
export function takeWhileChar1(
  predicate: (ch: string) => boolean,
  expected: string
): Parser<string> {
  return takeWhileChar(predicate).flatMap(s =>
    s.length > 0
      ? Parser.lift(s)
      : Parser.error(`Expected at least one ${expected}`)
  )
}

/**
 * Creates a parser that consumes characters until the predicate holds.
 * Always succeeds (possibly with an empty string).
 *
 * @param predicate - Function that tests each character
 * @returns {Parser<string>} A parser producing the characters before the match
 */
export function takeUntilChar(
  predicate: (ch: string) => boolean
): Parser<string> {
  return takeWhileChar(ch => !predicate(ch))
}

/**
 * Creates a parser that consumes exactly n characters.
 *
 * @param n - The number of characters to take
 * @returns {Parser<string>} A parser producing the next n characters
 */
export function takeN(n: number): Parser<string> {
  return new Parser(state => {
    const remaining = state.source.length - state.offset
    if (remaining < n) {
      return Parser.fail(
        {
          message: `Expected ${n} characters but only ${remaining} remaining`,
          expected: [`${n} characters`]
        },
        state
      )
    }
    return Parser.succeed(State.peek(state, n), State.consume(state, n))
  })
}

const manyCharsBy = (predicate: (ch: string) => boolean): Parser<string[]> =>
  takeWhileChar(predicate).map(s => s.split(""))

const many1CharsBy = (
  predicate: (ch: string) => boolean,
  expected: string
): Parser<string[]> => takeWhileChar1(predicate, expected).map(s => s.split(""))

/**
 * Creates a parser that matches zero or more occurrences of the given character.
 */
export function manyChar<T extends string>(ch: T): Parser<T[]> {
  if (ch.length !== 1) {
    throw new Error("manyChar only accepts single characters")
  }
  return takeWhileChar(c => c === ch).map(s => s.split("") as T[])
}

/** Matches zero or more digit characters (0-9). */
export const manyDigit = (): Parser<string[]> => manyCharsBy(isDigit)

/** Matches one or more digit characters (0-9). */
export const many1Digit = (): Parser<string[]> => many1CharsBy(isDigit, "digit")

/** Matches zero or more alphabetic characters (a-z, A-Z). */
export const manyAlphabet = (): Parser<string[]> => manyCharsBy(isAlphabet)

/** Matches one or more alphabetic characters (a-z, A-Z). */
export const many1Alphabet = (): Parser<string[]> =>
  many1CharsBy(isAlphabet, "letter")

/** Matches zero or more alphanumeric characters (a-z, A-Z, 0-9). */
export const manyAlphanumeric = (): Parser<string[]> =>
  manyCharsBy(isAlphanumeric)

/** Matches one or more alphanumeric characters (a-z, A-Z, 0-9). */
export const many1Alphanumeric = (): Parser<string[]> =>
  many1CharsBy(isAlphanumeric, "alphanumeric character")

/** Matches zero or more whitespace characters (space, tab, newline). */
export const manyWhitespace = (): Parser<string[]> => manyCharsBy(isWhitespace)

/** Skips zero or more whitespace characters (space, tab, newline). */
export const skipWhitespace = (): Parser<void> =>
  takeWhileChar(isWhitespace).map(() => undefined)

/**
 * A parser that skips any number of space characters.
 */
export const skipSpaces = takeWhileChar(ch => ch === " ").map(() => undefined)

/**
 * Creates a parser that matches zero or more occurrences of elements separated by a separator.
 *
 * @param parser - Parser for the elements
 * @param sepParser - Parser for the separator between elements
 * @returns {Parser<T[]>} A parser that produces an array of matched elements
 *
 * ```ts
 * const parser = sepBy(digit, char(','))
 * parser.run("1,2,3") // Right([["1", "2", "3"], {...}])
 * parser.run("") // Right([[], {...}])
 * ```
 */
export function sepBy<S, T>(
  parser: Parser<T>,
  sepParser: Parser<S>
): Parser<T[]> {
  return or(sepBy1(parser, sepParser), Parser.pure([]))
}

/**
 * Parses one or more occurrences of a parser separated by another parser.
 * Requires at least one match of the main parser.
 *
 * @param par - The parser for the elements
 * @param sepParser - The parser for the separator
 * @returns {Parser<T[]>} A parser that produces a non-empty array of parsed elements
 *
 * @example
 * ```ts
 * const numbers = sepBy1(number, char(','))
 * numbers.parse("1,2,3") // Success: [1, 2, 3]
 * numbers.parse("") // Error: Expected at least one element
 * ```
 */
export function sepBy1<S, T>(
  par: Parser<T>,
  sepParser: Parser<S>
): Parser<T[]> {
  return parser(function* () {
    const first = yield* par
    const rest = yield* many0(sepParser.then(par))
    return [first, ...rest]
  })
}

/**
 * Parses a list with optional trailing separator.
 *
 * @param par - The parser for list elements
 * @param sep - The parser for separators
 * @returns {Parser<T[]>} A parser that allows optional trailing separator
 *
 * @example
 * ```ts
 * const list = sepEndBy(number, char(','))
 * list.parse("1,2,3") // Success: [1, 2, 3]
 * list.parse("1,2,3,") // Success: [1, 2, 3] (trailing comma OK)
 * ```
 */
export const sepEndBy = <S, T>(par: Parser<T>, sep: Parser<S>): Parser<T[]> =>
  sepBy(par, sep).thenDiscard(optional(sep))

/**
 * Creates a parser that matches content between two delimiters.
 *
 * @param start - The opening delimiter parser
 * @param end - The closing delimiter parser
 * @param par - The parser for the content between delimiters
 * @returns {Parser<T>} A parser that matches content between delimiters
 *
 * ```ts
 * const parser = between(char('('), char(')'), digit)
 * parser.run('(5)') // Right(['5', {...}])
 * parser.run('(5') // Left(error: Expected closing delimiter)
 * ```
 */
export function between<T>(
  start: Parser<any>,
  end: Parser<any>,
  par: Parser<T>
): Parser<T> {
  return parser(function* () {
    yield* start
    const content = yield* par
    yield* end.expect("closing delimiter")
    return content
  })
}

/**
 * Internal helper for creating repetition parsers with a minimum count.
 * Commit-aware: if an iteration fails after committing, the failure propagates
 * instead of ending the repetition.
 */
function many_<S, T>(
  count: number
): (parser: Parser<T>, separator?: Parser<S>) => Parser<T[]> {
  return (parser: Parser<T>, separator?: Parser<S>): Parser<T[]> =>
    new Parser(state => {
      const results: T[] = []
      let currentState = state

      while (true) {
        const itemResult = parser.run({ ...currentState, committed: false })
        if (itemResult.result._tag === "Left") {
          if (itemResult.state.committed) {
            return itemResult as ParserOutput<any>
          }

          if (results.length >= count) {
            return Parser.succeed(results, currentState)
          }
          const message = `Expected at least ${count} occurrences, but only found ${results.length}`
          return Parser.fail({ message, expected: [] }, itemResult.state)
        }

        results.push(itemResult.result.right)

        if (itemResult.state.offset <= currentState.offset) {
          throw new Error("Parser did not advance - infinite loop prevented")
        }
        currentState = itemResult.state

        if (separator) {
          const { result: sepResult, state: sepState } =
            separator.run(currentState)
          if (sepResult._tag === "Left") {
            break
          }
          if (sepState.offset <= currentState.offset) {
            throw new Error(
              "Separator parser did not advance - infinite loop prevented"
            )
          }
          currentState = sepState
        }
      }

      if (results.length >= count) {
        return Parser.succeed(results, currentState)
      }

      const message = `Expected at least ${count} occurrences, but only found ${results.length}`
      return Parser.fail({ message, expected: [] }, currentState)
    })
}

/**
 * Creates a parser that matches zero or more occurrences of the input parser.
 *
 * @param parser - The parser to repeat
 * @param separator - Optional parser to match between occurrences
 * @returns {Parser<T[]>} A parser that produces an array of all matches
 */
export const many0 = <S, T>(
  parser: Parser<T>,
  separator?: Parser<S>
): Parser<T[]> => many_<S, T>(0)(parser, separator)

/**
 * Parses zero or more occurrences of a parser (alias for many0).
 *
 * @param parser - The parser to repeat
 * @returns {Parser<T[]>} A parser that produces an array of parsed elements
 */
export const many = <T>(parser: Parser<T>): Parser<T[]> => many0(parser)

/**
 * Creates a parser that matches one or more occurrences of the input parser.
 *
 * @param parser - The parser to repeat
 * @param separator - Optional parser to match between occurrences
 * @returns {Parser<T[]>} A parser that produces an array of all matches (at least one)
 */
export const many1 = <S, T>(
  parser: Parser<T>,
  separator?: Parser<S>
): Parser<T[]> => many_<S, T>(1)(parser, separator)

/**
 * Creates a parser that matches at least n occurrences of the input parser.
 *
 * @param parser - The parser to repeat
 * @param n - Minimum number of required repetitions
 * @param separator - Optional parser to match between occurrences
 * @returns {Parser<T[]>} A parser that produces an array of at least n matches
 */
export const manyN = <S, T>(
  parser: Parser<T>,
  n: number,
  separator?: Parser<S>
): Parser<T[]> => many_<S, T>(n)(parser, separator)

/**
 * Creates a parser that matches exactly n occurrences of the input parser.
 *
 * @param par - The parser to repeat
 * @param n - Number of required repetitions
 * @param separator - Optional parser to match between occurrences
 * @returns {Parser<T[]>} A parser that produces an array of exactly n matches
 */
export const manyNExact = <S, T>(
  par: Parser<T>,
  n: number,
  separator?: Parser<S>
): Parser<T[]> =>
  parser(function* () {
    const results = yield* manyN(par, n, separator)
    if (results.length !== n) {
      const message = `Expected exactly ${n} occurrences, but found ${results.length}`
      return yield* Parser.fatal(message)
    }
    return results
  })

/**
 * Parses exactly n occurrences of a parser.
 *
 * @param n - The exact number of occurrences
 * @param par - The parser to repeat
 * @returns {Parser<T[]>} A parser that produces an array of exactly n elements
 *
 * @example
 * ```ts
 * const threeDigits = count(3, digit)
 * threeDigits.parse("123") // Success: ['1', '2', '3']
 * threeDigits.parse("12") // Error: not enough matches
 * ```
 */
export function count<T>(n: number, par: Parser<T>): Parser<T[]> {
  return parser(function* () {
    const results: T[] = []
    for (let i = 0; i < n; i++) {
      results.push(yield* par)
    }
    return results
  })
}

/**
 * Internal helper for creating skipping repetition parsers.
 */
const skipMany_ =
  <T>(count: number): ((parser: Parser<T>) => Parser<undefined>) =>
  (parser: Parser<T>): Parser<undefined> =>
    new Parser(state => {
      let currentState = state
      let successes = 0

      while (true) {
        const { result, state: newState } = parser.run(currentState)
        if (result._tag === "Left") {
          break
        }
        if (newState.offset <= currentState.offset) {
          throw new Error("Parser did not advance - infinite loop prevented")
        }
        successes++
        currentState = newState
      }

      if (successes >= count) {
        return Parser.succeed(undefined, currentState)
      }
      const message = `Expected at least ${count} occurrences, but only found ${successes}`
      return Parser.fail({ message, expected: [] }, state)
    })

/**
 * Creates a parser that skips zero or more occurrences of the input parser.
 *
 * @param parser - The parser to skip
 * @returns {Parser<undefined>} A parser that skips all matches
 */
export const skipMany0 = <T>(parser: Parser<T>): Parser<undefined> =>
  skipMany_<T>(0)(parser)

/**
 * Creates a parser that skips one or more occurrences of the input parser.
 *
 * @param parser - The parser to skip
 * @returns {Parser<undefined>} A parser that skips all matches (requires at least one)
 */
export const skipMany1 = <T>(parser: Parser<T>): Parser<undefined> =>
  skipMany_<T>(1)(parser)

/**
 * Creates a parser that skips at least n occurrences of the input parser.
 *
 * @param parser - The parser to skip
 * @param n - Minimum number of repetitions to skip
 * @returns A parser that skips at least n matches
 */
export const skipManyN = <T>(parser: Parser<T>, n: number) =>
  skipMany_<T>(n)(parser)

/**
 * Creates a parser that skips input until the given parser succeeds.
 * The matching input is consumed.
 *
 * @param parser - The parser to look for
 * @returns A parser that skips input until a match is found
 */
export function skipUntil<T>(parser: Parser<T>): Parser<undefined> {
  return new Parser(state => {
    let currentState = state

    while (!State.isAtEnd(currentState)) {
      const { result, state: newState } = parser.run(currentState)
      if (result._tag === "Right") {
        return Parser.succeed(undefined, newState)
      }
      currentState = State.consume(currentState, 1)
    }

    return Parser.succeed(undefined, currentState)
  })
}

/**
 * Creates a parser that takes input until the given parser succeeds.
 * The matching input is consumed but not included in the result.
 *
 * @param parser - The parser to look for
 * @returns A parser producing the input before the match
 */
export function takeUntil<T>(parser: Parser<T>): Parser<string> {
  return new Parser(state => {
    let currentState = state

    while (!State.isAtEnd(currentState)) {
      const { result, state: newState } = parser.run(currentState)
      if (result._tag === "Right") {
        return Parser.succeed(
          state.source.slice(state.offset, currentState.offset),
          newState
        )
      }
      currentState = State.consume(currentState, 1)
    }

    return Parser.succeed(State.remaining(state), currentState)
  })
}

/**
 * Creates a parser that takes input until the given parser would succeed,
 * without consuming the match itself.
 *
 * @param parser - The parser to look for
 * @returns A parser producing the input before the match
 */
export function takeUpto<T>(parser: Parser<T>): Parser<string> {
  return new Parser(state => {
    let currentState = state

    while (!State.isAtEnd(currentState)) {
      const { result } = parser.run(currentState)
      if (result._tag === "Right") {
        break
      }
      currentState = State.consume(currentState, 1)
    }

    return Parser.succeed(
      state.source.slice(state.offset, currentState.offset),
      currentState
    )
  })
}

/**
 * Creates a parser that takes input until the given character is found.
 * The character itself is not consumed.
 *
 * @param ch - The character to look for
 * @returns A parser producing the input before the character
 */
export function parseUntilChar(ch: string): Parser<string> {
  if (ch.length !== 1) {
    throw new Error("parseUntilChar expects a single character")
  }
  return new Parser(state => {
    const index = state.source.indexOf(ch, state.offset)
    if (index === -1) {
      const collected = State.remaining(state)
      return Parser.fail(
        {
          message: `Expected character ${ch} but found ${collected}`,
          expected: [ch]
        },
        State.consume(state, collected.length)
      )
    }
    const collected = state.source.slice(state.offset, index)
    return Parser.succeed(collected, State.consume(state, collected.length))
  })
}

/**
 * Creates a parser that tries each of the given parsers in order until one succeeds.
 *
 * This combinator is commit-aware: if any parser sets the `committed` flag during
 * parsing, no further alternatives will be tried. This enables better error messages
 * by preventing backtracking once we've identified the intended parse path.
 *
 * @param parsers - Array of parsers to try in order
 * @returns {Parser<...>} A parser that succeeds with the first successful parser's result
 *
 * @example
 * ```ts
 * // Basic usage - tries each alternative
 * const value = or(numberLiteral, stringLiteral, booleanLiteral)
 * ```
 *
 * @example
 * ```ts
 * // With commit for better errors
 * const statement = or(
 *   parser(function* () {
 *     yield* keyword("if")
 *     yield* commit()  // No backtracking after this
 *     yield* char('(').expect("opening parenthesis")
 *     // ...
 *   }),
 *   whileStatement,
 *   assignment
 * )
 *
 * // Input: "if x > 5"  (missing parentheses)
 * // Without commit: "Expected if, while, or assignment"
 * // With commit: "Expected opening parenthesis"
 * ```
 */
export function or<Parsers extends Parser<any>[]>(
  ...parsers: Parsers
): Parser<Parsers[number] extends Parser<infer T> ? T : never> {
  return new Parser(state => {
    const errors: ParseError[] = []

    for (const parser of parsers) {
      const { result, state: newState } = parser.run(state)

      if (result._tag === "Right") {
        return Parser.succeed(result.right, newState)
      }

      errors.push(...result.left.errors)

      if (newState.committed && !state.committed) {
        return Parser.failRich({ errors }, newState)
      }
    }

    return Parser.failRich({ errors }, state)
  })
}

/**
 * Creates a parser that optionally matches the input parser.
 * If the parser fails without committing, returns undefined without consuming input.
 *
 * @param parser - The parser to make optional
 * @returns {Parser<T | undefined>} A parser that either succeeds with a value or undefined
 */
export function optional<T>(parser: Parser<T>): Parser<T | undefined> {
  return new Parser(state => {
    const { result, state: newState } = parser.run(state)
    if (result._tag === "Left") {
      if (newState.committed && !state.committed) {
        return ParserOutput(newState, result)
      }
      return Parser.succeed(undefined, state)
    }
    return Parser.succeed(result.right, newState)
  })
}

type SequenceOutput<
  T extends Parser<any>[],
  Acc extends any[] = []
> = T["length"] extends 0
  ? Acc
  : T extends [Parser<infer Head extends any>, ...infer Tail extends any[]]
    ? SequenceOutput<Tail, [...Acc, Head]>
    : never

/**
 * Creates a parser that runs multiple parsers in sequence and returns all results.
 *
 * @param parsers - Array of parsers to run in sequence
 * @returns {Parser<SequenceOutput<T>>} A parser that succeeds if all parsers succeed in order, returning a tuple of all results
 *
 * @example
 * ```ts
 * const parser = sequence([digit, char('-'), digit])
 * parser.run('1-2') // Right([['1', '-', '2'], {...}])
 * ```
 */
export const sequence = <const T extends any[]>(
  parsers: T
): Parser<SequenceOutput<T>> =>
  parser(function* () {
    const results = []
    for (const parser of parsers) {
      results.push(yield* parser)
    }
    return results as any
  })

/**
 * Creates a parser that matches input against a regular expression.
 * The regex must match at the current input position.
 *
 * @param re - The regular expression to match against
 * @returns {Parser<string>} A parser that matches the regex pattern
 */
export const regex = (re: RegExp): Parser<string> => {
  const stickyRe = new RegExp(re.source, "y")

  return new Parser(state => {
    stickyRe.lastIndex = state.offset
    const match = stickyRe.exec(state.source)
    if (match) {
      const value = match[0]
      return Parser.succeed(value, State.consume(state, value.length))
    }
    const message = `Expected ${re} but found ${State.peek(state, 10)}...`
    return Parser.fail({ message, expected: [re.toString()] }, state)
  })
}

/**
 * Combines two parsers, returning both results as a tuple.
 * Standalone version of {@link Parser.zip}.
 */
export function zip<A, B>(
  parserA: Parser<A>,
  parserB: Parser<B>
): Parser<[A, B]> {
  return parserA.zip(parserB)
}

/**
 * Sequences two parsers, keeping the second result.
 * Standalone version of {@link Parser.then}.
 *
 * Note: deliberately not exported as `then` — a module export named `then`
 * makes the module namespace a thenable, which breaks `await import(...)`.
 */
export function zipRight<A, B>(
  parserA: Parser<A>,
  parserB: Parser<B>
): Parser<B> {
  return parserA.then(parserB)
}

/**
 * Sequences two parsers, keeping the first result.
 * Standalone version of {@link Parser.thenDiscard}.
 */
export function thenDiscard<A, B>(
  parserA: Parser<A>,
  parserB: Parser<B>
): Parser<A> {
  return parserA.thenDiscard(parserB)
}

export const zipLeft = thenDiscard

/**
 * Creates a parser that commits to the current parsing path, preventing backtracking.
 *
 * After calling `commit()`, if parsing fails later in the sequence, the parser won't
 * backtrack to try alternatives in an `or` combinator. This results in more specific,
 * helpful error messages instead of generic "expected one of" errors.
 *
 * @returns {Parser<void>} A parser that sets the commit flag in the parsing state
 *
 * @example
 * ```ts
 * const ifStatement = parser(function* () {
 *   yield* keyword("if")
 *   yield* commit()  // No backtracking after this point
 *   yield* char('(').expect("opening parenthesis after 'if'")
 *   const condition = yield* expression
 *   yield* char(')').expect("closing parenthesis")
 *   return { type: "if", condition }
 * })
 * ```
 *
 * @see {@link cut} - Alias with Prolog-style naming
 */
export function commit(): Parser<void> {
  return new Parser(state =>
    Parser.succeed(undefined, { ...state, committed: true })
  )
}

/**
 * Alias for {@link commit} using Prolog-style naming.
 *
 * The cut operator (!) in Prolog prevents backtracking, similar to how
 * this prevents the parser from trying other alternatives after this point.
 */
export const cut = commit

/**
 * Creates an atomic parser that either fully succeeds or resets to the original state.
 * Standalone version of {@link Parser.atomic}.
 *
 * @param parser - The parser to make atomic
 * @returns {Parser<T>} A new parser with atomic (all-or-nothing) behavior
 *
 * @example
 * ```ts
 * const value = or(
 *   atomic(complexExpression),  // If this fails midway, backtrack completely
 *   literal
 * )
 * ```
 */
export function atomic<T>(parser: Parser<T>): Parser<T> {
  return parser.atomic()
}

/**
 * Parser that succeeds only at the end of input.
 *
 * @example
 * ```ts
 * const parser = string("hello").thenDiscard(eof)
 * parser.parse("hello") // Success
 * parser.parse("hello world") // Error: Expected end of input
 * ```
 */
export const eof = new Parser<void>(state => {
  if (State.isAtEnd(state)) {
    return Parser.succeed(undefined, state)
  }
  const rest = State.remaining(state)
  return Parser.fail(
    {
      message: "Expected end of input",
      expected: ["end of input"],
      found: rest.slice(0, 20) + (rest.length > 20 ? "..." : "")
    },
    state
  )
})

/**
 * Parser that produces the current source position without consuming input.
 */
export const position: Parser<SourcePosition> = new Parser(state =>
  ParserOutput(state, Either.right(State.toPosition(state)))
)
