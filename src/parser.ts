import { Either } from "./either.ts"
import {
  LazyCustomError,
  ParseError,
  ParseErrorBundle,
  Span
} from "./errors.ts"

const emptyContext: string[] = []
import { ParserOutput, type ParserState, type Spanned, State } from "./state.ts"

/**
 * Parser is the core type that represents a parser combinator.
 *
 * A parser is a function that takes an input state and produces either:
 * - A successful parse result with the remaining input state
 * - An error describing why the parse failed
 *
 * Parsers can be composed using various combinators to build complex parsers
 * from simple building blocks.
 *
 * @template T The type of value this parser produces when successful
 */
export class Parser<T> {
  run: (state: ParserState) => ParserOutput<T>

  constructor(run: (state: ParserState) => ParserOutput<T>) {
    this.run = run
  }

  /**
   * Creates a successful parser output with the given value and state.
   *
   * @param value - The value to wrap in a successful result
   * @param state - The current parser state
   * @returns {ParserOutput<T>} A successful parser output containing the value
   * @template T The type of the successful value
   * @internal
   */
  static succeed<T>(value: T, state: ParserState): ParserOutput<T> {
    return ParserOutput(state, Either.right(value))
  }

  /**
   * Creates a parser that always succeeds with the given value without consuming any input.
   *
   * @param a - The value to lift into the parser context
   * @returns {Parser<A>} A parser that always succeeds with the given value
   * @template A The type of the value being lifted
   *
   * @example
   * ```ts
   * const always42 = Parser.lift(42)
   * always42.parse("any input") // succeeds with 42
   *
   * // Useful for providing default values
   * const parseNumberOrDefault = number.or(Parser.lift(0))
   * ```
   */
  static lift = <A>(a: A): Parser<A> =>
    new Parser(state => Parser.succeed(a, state))

  /**
   * Creates a parser that always succeeds with the given value without consuming input.
   * Alias for `Parser.lift` following the monadic naming convention.
   *
   * @param a - The value to wrap in a successful parser
   * @returns {Parser<A>} A parser that always succeeds with the given value
   * @template A The type of the value being lifted
   */
  static pure = Parser.lift

  /**
   * Lifts a binary function into the parser context, applying it to the results of two parsers.
   *
   * @param ma - The first parser
   * @param mb - The second parser
   * @param f - A function that takes the results of both parsers and produces a new value
   * @returns {Parser<C>} A parser that applies the function to the results of both input parsers
   *
   * @example
   * ```ts
   * const parsePoint = Parser.liftA2(
   *   number,
   *   number.trimLeft(comma),
   *   (x, y) => ({ x, y })
   * )
   * parsePoint.parse("10, 20") // succeeds with { x: 10, y: 20 }
   * ```
   */
  static liftA2 = <A, B, C>(
    ma: Parser<A>,
    mb: Parser<B>,
    f: (a: A, b: B) => C
  ): Parser<C> => ma.zip(mb).map(args => f(...args))

  /**
   * Applies a parser that produces a function to a parser that produces a value.
   *
   * @param ma - A parser that produces a value
   * @param mf - A parser that produces a function from that value type to another type
   * @returns {Parser<B>} A parser that applies the parsed function to the parsed value
   */
  static ap = <A, B>(ma: Parser<A>, mf: Parser<(_: A) => B>): Parser<B> =>
    mf.zip(ma).map(([f, a]) => f(a))

  /**
   * Creates a failed parser output with the given error information.
   *
   * @param error - Error details including message and optional expected/found values
   * @param state - The parser state where the error occurred
   * @returns {ParserOutput<never>} A failed parser output containing the error
   * @internal
   */
  static fail(
    error: {
      message: string | (() => string)
      expected?: string[]
      found?: string
    },
    state: ParserState
  ): ParserOutput<never> {
    // Failures are allocated on every backtracked alternative, so this path
    // is hot. LazyCustomError has a stable shape (single hidden class) and
    // defers both message building (when given as a thunk) and line/column
    // computation until the error is actually displayed — most failures are
    // discarded by backtracking in `or`/`optional` and never shown.
    const parseErr: ParseError = new LazyCustomError(
      Span(state),
      error.message,
      state.labelStack ?? emptyContext
    )
    return ParserOutput(
      state,
      Either.left(new ParseErrorBundle([parseErr], state.source))
    )
  }

  /**
   * Creates a failed parser output from pre-built ParseError values.
   *
   * @param errorBundle - The error bundle containing the errors to be displayed
   * @param state - The current parser state
   * @returns {ParserOutput<never>} A parser output with the error bundle and the current state
   * @internal
   */
  static failRich(
    errorBundle: { errors: ParseError[] },
    state: ParserState
  ): ParserOutput<never> {
    return ParserOutput(
      state,
      Either.left(new ParseErrorBundle(errorBundle.errors, state.source))
    )
  }

  /**
   * Creates a parser that always fails with the given message.
   *
   * Unlike {@link Parser.fatal}, this is a recoverable failure: choice
   * combinators like `or` and `optional` can backtrack and try alternatives.
   *
   * @param message - The error message to display
   * @returns {Parser<never>} A parser that always fails
   *
   * @example
   * ```ts
   * const identifier = regex(/[a-z]+/).flatMap(name =>
   *   keywords.has(name) ?
   *     Parser.error(`'${name}' is a reserved keyword`)
   *   : Parser.lift(name)
   * )
   * ```
   */
  static error = (message: string): Parser<never> =>
    new Parser(state => Parser.fail({ message }, state))

  /**
   * Creates a parser that always fails with a fatal error.
   *
   * Fatal errors are non-recoverable and prevent backtracking in choice combinators.
   * Use this when you've determined that the input is definitely malformed and trying
   * other alternatives would be meaningless.
   *
   * @param message - The error message to display
   * @returns {Parser<never>} A parser that always fails with a fatal error
   *
   * @example
   * ```ts
   * const number = regex(/-?[0-9]+/).map(Number);
   * const parsePositive = number.flatMap(n =>
   *   n > 0 ? Parser.lift(n) : Parser.fatal("Expected positive number")
   * )
   * ```
   */
  static fatal = (message: string): Parser<never> =>
    new Parser(state =>
      ParserOutput(
        { ...state, committed: true },
        Either.left(
          new ParseErrorBundle(
            [
              ParseError.fatal({
                span: Span(state),
                message,
                context: state.labelStack ?? []
              })
            ],
            state.source
          )
        )
      )
    )

  /**
   * Creates a new parser that lazily evaluates the given function.
   * This is useful for creating recursive parsers.
   *
   * @param fn - A function that returns a parser
   * @returns {Parser<T>} A new parser that evaluates the function when parsing
   *
   * @example
   * ```ts
   * const parens: Parser<string> = Parser.lazy(() =>
   *   between(char('('), char(')'), parens)
   * )
   * ```
   */
  static lazy<T>(fn: () => Parser<T>): Parser<T> {
    let cached: Parser<T> | undefined
    return new Parser(state => (cached ??= fn()).run(state))
  }

  /**
   * Runs the parser on the given input string and returns the full parser output.
   *
   * This method provides access to both the parse result and the final parser state,
   * which includes information about the remaining unparsed input and position.
   *
   * @param input - The string to parse
   * @returns {ParserOutput<T>} A parser output containing both the result (success or error) and final state
   *
   * @example
   * ```ts
   * const parser = string("hello");
   * const output = parser.parse("hello world");
   * // output.result contains Either.right("hello")
   * // output.state contains position info for the remaining " world"
   * ```
   */
  parse(input: string): ParserOutput<T> {
    return this.run(State.fromInput(input))
  }

  /**
   * Runs the parser on the given input and returns either the parsed value or error bundle.
   *
   * @param input - The string to parse
   * @returns {T | ParseErrorBundle} The successfully parsed value of type T, or a ParseErrorBundle on failure
   *
   * @example
   * ```ts
   * const result = number.parseOrError("42");
   * if (result instanceof ParseErrorBundle) {
   *   console.error(result.format());
   * } else {
   *   console.log(result); // 42
   * }
   * ```
   */
  parseOrError(input: string): T | ParseErrorBundle {
    const { result } = this.parse(input)
    return result._tag === "Right" ? result.right : result.left
  }

  /**
   * Runs the parser on the given input and returns the parsed value or throws an error.
   *
   * @param input - The string to parse
   * @returns {T} The successfully parsed value of type T
   * @throws {ParseErrorBundle} Thrown when parsing fails
   *
   * @example
   * ```ts
   * try {
   *   const value = number.parseOrThrow("42"); // 42
   * } catch (error) {
   *   if (error instanceof ParseErrorBundle) {
   *     console.error(error.format());
   *   }
   * }
   * ```
   */
  parseOrThrow(input: string): T {
    const { result } = this.parse(input)
    if (result._tag === "Left") {
      throw result.left
    }
    return result.right
  }

  /**
   * Transforms the result of this parser by applying a function to the parsed value.
   *
   * @param f - A function that transforms the parsed value
   * @returns {Parser<B>} A new parser that produces the transformed value
   *
   * @example
   * ```ts
   * const doubled = number.map(n => n * 2);
   * doubled.parse("21") // succeeds with 42
   * ```
   */
  map<B>(f: (a: T) => B): Parser<B> {
    return new Parser<B>(state => {
      const output = this.run(state)
      if (output.result._tag === "Left") {
        return output as unknown as ParserOutput<B>
      }
      return ParserOutput(output.state, Either.right(f(output.result.right)))
    })
  }

  /**
   * Chains this parser with another parser that depends on the result of this one.
   *
   * This is the monadic bind operation. It allows you to create a parser whose
   * behavior depends on the result of a previous parse, which is essential for
   * context-sensitive parsing.
   *
   * @param f - A function that takes the parsed value and returns a new parser
   * @returns {Parser<B>} A new parser that runs the second parser after the first succeeds
   *
   * @example
   * ```ts
   * // Parse a number and then that many 'a' characters
   * const parser = number.flatMap(n => string('a'.repeat(n)));
   * parser.parse("3aaa") // succeeds with "aaa"
   * ```
   */
  flatMap<B>(f: (a: T) => Parser<B>): Parser<B> {
    return new Parser<B>(state => {
      const output = this.run(state)
      if (output.result._tag === "Left") {
        return output as unknown as ParserOutput<B>
      }
      return f(output.result.right).run(output.state)
    })
  }

  /**
   * Combines this parser with another parser, returning both results as a tuple.
   *
   * @param parserB - The second parser to run after this one
   * @returns {Parser<[T, B]>} A parser that produces a tuple of both results
   *
   * @example
   * ```ts
   * const keyValue = identifier.zip(number.trimLeft(colon));
   * keyValue.parse("age:30") // succeeds with ["age", 30]
   * ```
   */
  zip<B>(parserB: Parser<B>): Parser<[T, B]> {
    return new Parser(state => {
      const outputA = this.run(state)
      if (outputA.result._tag === "Left") {
        return outputA as unknown as ParserOutput<[T, B]>
      }
      const outputB = parserB.run(outputA.state)
      if (outputB.result._tag === "Left") {
        return outputB as unknown as ParserOutput<[T, B]>
      }
      return Parser.succeed(
        [outputA.result.right, outputB.result.right],
        outputB.state
      )
    })
  }

  /**
   * Sequences this parser with another, keeping only the second result.
   *
   * @param parserB - The parser whose result will be kept
   * @returns {Parser<B>} A parser that produces only the second result
   *
   * @example
   * ```ts
   * const labeledValue = string("value:").then(number);
   * labeledValue.parse("value:42") // succeeds with 42
   * ```
   */
  // Deliberate sequencing API; the module namespace does NOT export a `then`
  // oxlint-disable-next-line unicorn/no-thenable
  then<B>(parserB: Parser<B>): Parser<B> {
    return new Parser<B>(state => {
      const outputA = this.run(state)
      if (outputA.result._tag === "Left") {
        return outputA as unknown as ParserOutput<B>
      }
      return parserB.run(outputA.state)
    })
  }

  /**
   * Alias for `then` - sequences parsers and keeps the right result.
   * @see {@link then}
   */
  zipRight<B>(parserB: Parser<B>): Parser<B> {
    return this.then(parserB)
  }

  /**
   * Sequences this parser with another, keeping only the first result.
   *
   * @param parserB - The parser to run but whose result will be discarded
   * @returns {Parser<T>} A parser that produces only the first result
   *
   * @example
   * ```ts
   * const statement = expression.thenDiscard(char(';'));
   * ```
   */
  thenDiscard<B>(parserB: Parser<B>): Parser<T> {
    return new Parser<T>(state => {
      const outputA = this.run(state)
      if (outputA.result._tag === "Left") {
        return outputA
      }
      const outputB = parserB.run(outputA.state)
      if (outputB.result._tag === "Left") {
        return outputB as unknown as ParserOutput<T>
      }
      return ParserOutput(outputB.state, outputA.result)
    })
  }

  /**
   * Alias for `thenDiscard` - sequences parsers and keeps the left result.
   * @see {@link thenDiscard}
   */
  zipLeft<B>(parserB: Parser<B>): Parser<T> {
    return this.thenDiscard(parserB)
  }

  /**
   * Makes this parser usable in generator syntax (`yield*`) inside `parser(function* () { ... })`.
   * @internal
   */
  *[Symbol.iterator](): Generator<Parser<T>, T, any> {
    return yield this
  }

  /**
   * Adds a tap point to observe the current state and result during parsing.
   * Useful for debugging parser behavior.
   *
   * @param callback - Function called with current state and result
   * @returns {Parser<T>} The same parser with the tap point added
   */
  tap(
    callback: (args: { state: ParserState; result: ParserOutput<T> }) => void
  ): Parser<T> {
    return new Parser(state => {
      const result = this.run(state)
      callback({ state, result })
      return result
    })
  }

  /**
   * Runs a generator function as a sequence of parsers, threading state through
   * each `yield*`. This is the engine behind the `parser(function* () { ... })` syntax.
   *
   * @example
   * ```ts
   * const keyValue = parser(function* () {
   *   const key = yield* identifier
   *   yield* char(':')
   *   const value = yield* number
   *   return { key, value }
   * })
   * ```
   */
  static gen = <T>(f: () => Generator<Parser<any>, T, any>): Parser<T> =>
    new Parser<T>(state => {
      const iterator = f()
      let current = iterator.next()
      let currentState = state
      while (!current.done) {
        const output = current.value.run(currentState)
        if (output.result._tag === "Left") {
          return output as unknown as ParserOutput<T>
        }
        currentState = output.state
        current = iterator.next(output.result.right)
      }
      return Parser.succeed(current.value, currentState)
    })

  /**
   * Wraps this parser to run (and discard) the given parser before and after it.
   */
  trim(parser: Parser<any>): Parser<T> {
    return parser.then(this).thenDiscard(parser)
  }

  /**
   * Wraps this parser to run (and discard) the given parser before it.
   */
  trimLeft(parser: Parser<any>): Parser<T> {
    return parser.then(this)
  }

  /**
   * Wraps this parser to run (and discard) the given parser after it.
   */
  trimRight(parser: Parser<any>): Parser<T> {
    return this.thenDiscard(parser)
  }

  /**
   * Adds a label to this parser for better error messages.
   * On failure, the error is reported as `Expected <name>` at the position
   * where this parser started.
   *
   * @param name - The label name to add to the context stack
   * @returns {Parser<T>} A new parser with the label added
   */
  label(name: string): Parser<T> {
    return new Parser(state => {
      const stack = state.labelStack ?? []
      const output = this.run({ ...state, labelStack: [name, ...stack] })

      if (output.result._tag === "Left") {
        return ParserOutput(
          state,
          Either.left(
            new ParseErrorBundle(
              [
                ParseError.expected({
                  span: Span(state),
                  items: [name],
                  context: [name, ...stack]
                })
              ],
              state.source
            )
          )
        )
      }

      return ParserOutput({ ...output.state, labelStack: stack }, output.result)
    })
  }

  /**
   * Replaces this parser's error with `Expected <description>` at the position
   * where the original error occurred.
   *
   * @param description - The description of what was expected
   * @returns {Parser<T>} A new parser with the friendlier error message
   */
  expect(description: string): Parser<T> {
    return new Parser<T>(state => {
      const output = this.run(state)
      if (output.result._tag === "Left") {
        const primaryError = output.result.left.primary
        // Preserve fatal errors: they must not be softened into expectations
        if (primaryError.tag === "Fatal") {
          return output
        }
        const errorState = {
          ...state,
          offset: primaryError.span.offset,
          committed: output.state.committed || state.committed
        }
        return Parser.fail({ message: `Expected ${description}` }, errorState)
      }
      return output
    })
  }

  /**
   * Commits to the current parsing path, preventing backtracking beyond this point.
   *
   * Once a parser is committed, if it fails later in the sequence, the error won't
   * backtrack to try other alternatives in an `or` combinator. This leads to more
   * specific error messages instead of generic "expected one of" errors.
   *
   * @returns {Parser<T>} A new parser that sets the commit flag after successful parsing
   *
   * @example
   * ```ts
   * // Once we see '{', it must be an object
   * const jsonObject = char('{')
   *   .commit()
   *   .then(objectContent)
   *   .expect("valid JSON object")
   * ```
   *
   * @see {@link commit} - Standalone function version
   * @see {@link cut} - Alias with Prolog-style naming
   */
  commit = (): Parser<T> =>
    new Parser(state => {
      const result = this.run(state)
      if (result.result._tag === "Right") {
        return ParserOutput({ ...result.state, committed: true }, result.result)
      }
      return result
    })

  /**
   * Creates an atomic parser that either fully succeeds or resets to the original state.
   *
   * This is useful for "all-or-nothing" parsing where you want to try a complex
   * parser but not consume any input if it fails.
   *
   * @returns {Parser<T>} A new parser that resets state on failure
   *
   * @example
   * ```ts
   * const value = or(
   *   expression.atomic(), // If this fails midway, no input is consumed
   *   literal
   * )
   * ```
   *
   * @see {@link atomic} - Standalone function version
   */
  atomic(): Parser<T> {
    return new Parser(state => {
      const result = this.run(state)
      if (result.result._tag === "Left") {
        return ParserOutput(state, result.result)
      }
      return result
    })
  }

  /**
   * Returns the parsed value together with the span of input it consumed.
   */
  spanned = (): Parser<Spanned<T>> =>
    new Parser(state => {
      const result = this.run(state)
      if (result.result._tag === "Right") {
        const span = Span(state, result.state.offset - state.offset)
        return ParserOutput(
          result.state,
          Either.right([result.result.right, span])
        )
      }
      return result as ParserOutput<Spanned<T>>
    })
}

/**
 * Creates a parser from a generator function, allowing sequential parsing with
 * `yield*` in an imperative style. Alias for `Parser.gen`.
 *
 * @example
 * ```ts
 * const point = parser(function* () {
 *   yield* char('(')
 *   const x = yield* number
 *   yield* char(',')
 *   const y = yield* number
 *   yield* char(')')
 *   return { x, y }
 * })
 * ```
 */
export const parser = Parser.gen
