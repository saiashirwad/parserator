// import { debug } from "./debug";
import { Either } from "./either";
import { ParseError, ParseErrorBundle, Span } from "./errors";
import { ParserOutput, type ParserState, State } from "./state";

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
  /**
   * Creates a new Parser instance.
   *
   * @param run - The parsing function that takes a parser state and returns a parse result
   */
  constructor(
    /**
     * @internal
     */
    public run: (state: ParserState) => ParserOutput<T>
  ) {}

  // Monad/Applicative

  /**
   * Creates a successful parser output with the given value and state.
   *
   * This is a low-level helper used internally to construct successful parse results.
   * It doesn't consume any input and returns the value with the current state unchanged.
   *
   * @param value - The value to wrap in a successful result
   * @param state - The current parser state
   * @returns {ParserOutput<T>} A successful parser output containing the value
   * @template T The type of the successful value
   * @internal
   */
  static succeed<T>(value: T, state: ParserState): ParserOutput<T> {
    return ParserOutput(state, Either.right(value));
  }

  /**
   * Creates a parser that always succeeds with the given value without consuming any input.
   *
   * This is the basic way to inject a value into the parser context. The parser will
   * succeed immediately with the provided value and won't advance the parser state.
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
   *
   * // Can be used to inject values in parser chains
   * const parser = parser(function* () {
   *   const name = yield* identifier
   *   const separator = yield* Parser.lift(":")
   *   const value = yield* number
   *   return { name, separator, value }
   * })
   * ```
   */
  static lift = <A>(a: A): Parser<A> =>
    new Parser(state => Parser.succeed(a, state));

  /**
   * Lifts a binary function into the parser context, applying it to the results of two parsers.
   *
   * This is the applicative functor's version of `map` for functions of two arguments.
   * It runs both parsers in sequence and applies the function to their results if both succeed.
   *
   * @param ma - The first parser
   * @param mb - The second parser
   * @param f - A function that takes the results of both parsers and produces a new value
   * @returns {Parser<C>} A parser that applies the function to the results of both input parsers
   * @template A The type of value produced by the first parser
   * @template B The type of value produced by the second parser
   * @template C The type of value produced by applying the function
   *
   * @example
   * ```ts
   * // Combine two parsed values with a function
   * const parsePoint = Parser.liftA2(
   *   number,
   *   number.trimLeft(comma),
   *   (x, y) => ({ x, y })
   * )
   * parsePoint.parse("10, 20") // succeeds with { x: 10, y: 20 }
   *
   * // Build a data structure from multiple parsers
   * const parsePerson = Parser.liftA2(
   *   identifier,
   *   number.trimLeft(colon),
   *   (name, age) => ({ name, age })
   * )
   * parsePerson.parse("John:30") // succeeds with { name: "John", age: 30 }
   * ```
   */
  static liftA2 = <A, B, C>(
    ma: Parser<A>,
    mb: Parser<B>,
    f: (a: A, b: B) => C
  ): Parser<C> => ma.zip(mb).map(args => f(...args));

  /**
   * Applies a parser that produces a function to a parser that produces a value.
   *
   * This is the applicative functor's application operator. It allows you to apply
   * functions within the parser context, enabling powerful composition patterns.
   *
   * @param ma - A parser that produces a value
   * @param mf - A parser that produces a function from that value type to another type
   * @returns {Parser<B>} A parser that applies the parsed function to the parsed value
   * @template A The type of the input value
   * @template B The type of the output value after function application
   *
   * @example
   * ```ts
   * // Parse a function name and apply it
   * const parseFn = choice([
   *   string("double").map(() => (x: number) => x * 2),
   *   string("square").map(() => (x: number) => x * x)
   * ])
   * const result = Parser.ap(number, parseFn.trimLeft(space))
   * result.parse("5 double") // succeeds with 10
   * result.parse("5 square") // succeeds with 25
   *
   * // Chain multiple applications
   * const add = (x: number) => (y: number) => x + y
   * const parseAdd = Parser.lift(add)
   * const addParser = Parser.ap(
   *   number,
   *   Parser.ap(number.trimLeft(plus), parseAdd)
   * )
   * addParser.parse("3 + 4") // succeeds with 7
   * ```
   */
  static ap = <A, B>(ma: Parser<A>, mf: Parser<(_: A) => B>): Parser<B> =>
    mf.zip(ma).map(([f, a]) => f(a));

  // Error handling

  /**
   * Creates a failed parser output with the given error information.
   *
   * This is a low-level helper for constructing parse errors. It creates a custom
   * error with the provided message and optional expected/found information.
   *
   * @param error - Error details including message and optional expected/found values
   * @param state - The parser state where the error occurred
   * @returns {ParserOutput<never>} A failed parser output containing the error
   * @internal
   */
  static fail(
    error: { message: string; expected?: string[]; found?: string },
    state: ParserState
  ): ParserOutput<never> {
    const span = Span({
      pos: {
        offset: state.pos.offset,
        line: state.pos.line,
        column: state.pos.column
      }
    });

    const parseErr = ParseError.custom({
      span,
      message: error.message,
      context: state?.labelStack ?? [],
      hints: []
    });

    const bundle = new ParseErrorBundle(
      [parseErr],
      // state?.source ?? state.remaining
      state.source
    );

    return ParserOutput(state, Either.left(bundle));
  }

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
        state,
        Either.left(
          new ParseErrorBundle(
            [
              ParseError.fatal({
                span: Span(state),
                message,
                context: state?.labelStack ?? []
              })
            ],
            // state?.source ?? state.remaining
            state.source
          )
        )
      )
    );

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
   * // output.state contains remaining input " world" and position info
   * ```
   */
  parse(input: string): ParserOutput<T> {
    const { result, state } = this.run(State.fromInput(input) as any);
    return ParserOutput(state, result);
  }

  /**
   * Runs the parser on the given input and returns either the parsed value or error bundle.
   *
   * This is a convenience method that unwraps the Either result, making it easier
   * to handle the common case where you just need the value or error without the
   * full parser state information.
   *
   * @param input - The string to parse
   * @returns {T | ParseErrorBundle} The successfully parsed value of type T, or a ParseErrorBundle on failure
   *
   * @example
   * ```ts
   * const parser = number();
   * const result = parser.parseOrError("42");
   * if (result instanceof ParseErrorBundle) {
   *   console.error(result.format());
   * } else {
   *   console.log(result); // 42
   * }
   * ```
   */
  parseOrError(input: string): T | ParseErrorBundle {
    const { result } = this.run(State.fromInput(input));
    if (Either.isRight(result)) {
      return result.right;
    }
    return result.left;
  }

  /**
   * Runs the parser on the given input and returns the parsed value or throws an error.
   *
   * This method is useful when you're confident the parse will succeed or want to
   * handle parse errors as exceptions. The thrown error is a ParseErrorBundle which
   * contains detailed information about what went wrong.
   *
   * @param input - The string to parse
   * @returns {T} The successfully parsed value of type T
   * @throws {ParseErrorBundle} Thrown when parsing fails
   *
   * @example
   * ```ts
   * const parser = number();
   * try {
   *   const value = parser.parseOrThrow("42");
   *   console.log(value); // 42
   * } catch (error) {
   *   if (error instanceof ParseErrorBundle) {
   *     console.error(error.format());
   *   }
   * }
   * ```
   */
  parseOrThrow(input: string): T {
    const { result } = this.parse(input);

    if (Either.isLeft(result)) {
      throw result.left;
    }
    return result.right;
  }

  /**
   * Transforms the result of this parser by applying a function to the parsed value.
   *
   * This is the functor map operation. If the parser succeeds, the function is applied
   * to the result. If the parser fails, the error is propagated unchanged. The input
   * is not consumed if the transformation fails.
   *
   * @param f - A function that transforms the parsed value
   * @returns {Parser<B>} A new parser that produces the transformed value
   * @template B The type of the transformed value
   *
   * @example
   * ```ts
   * // Parse a number and double it
   * const doubled = number().map(n => n * 2);
   * doubled.parse("21") // succeeds with 42
   *
   * // Parse a string and get its length
   * const stringLength = quoted('"').map(s => s.length);
   * stringLength.parse('"hello"') // succeeds with 5
   *
   * // Chain multiple transformations
   * const parser = identifier()
   *   .map(s => s.toUpperCase())
   *   .map(s => ({ name: s }));
   * parser.parse("hello") // succeeds with { name: "HELLO" }
   * ```
   */
  map<B>(f: (a: T) => B): Parser<B> {
    return new Parser<B>(state => {
      const { result, state: newState } = this.run(state);
      if (Either.isLeft(result)) {
        return ParserOutput(
          state,
          result as unknown as Either<B, ParseErrorBundle>
        );
      }
      // return Parser.succeed(f(result.right), newState);
      return ParserOutput(newState, Either.right(f(result.right)));
    });
  }

  /**
   * Chains this parser with another parser that depends on the result of this one.
   *
   * This is the monadic bind operation (also known as chain or andThen). It allows
   * you to create a parser whose behavior depends on the result of a previous parse.
   * This is essential for context-sensitive parsing where later parsing decisions
   * depend on earlier results.
   *
   * @param f - A function that takes the parsed value and returns a new parser
   * @returns {Parser<B>} A new parser that runs the second parser after the first succeeds
   * @template B The type of value produced by the resulting parser
   *
   * @example
   * ```ts
   * // Parse a number and then that many 'a' characters
   * const parser = number().flatMap(n =>
   *   string('a'.repeat(n))
   * );
   * parser.parse("3aaa") // succeeds with "aaa"
   *
   * // Parse a type annotation and return appropriate parser
   * const typeParser = identifier().flatMap(type => {
   *   switch(type) {
   *     case "int": return number();
   *     case "string": return quoted('"');
   *     default: return Parser.fail({ message: `Unknown type: ${type}` });
   *   }
   * });
   *
   * // Validate parsed values
   * const positiveNumber = number().flatMap(n =>
   *   n > 0
   *     ? Parser.lift(n)
   *     : Parser.fail({ message: "Expected positive number" })
   * );
   * ```
   */
  flatMap<B>(f: (a: T) => Parser<B>): Parser<B> {
    return new Parser<B>(state => {
      const { result, state: newState } = this.run(state);
      if (Either.isLeft(result)) {
        return {
          state: newState,
          result: result as unknown as Either<B, ParseErrorBundle>
        };
      }
      const nextParser = f(result.right);
      return nextParser.run(newState);
    });
  }

  /**
   * Creates a parser that always succeeds with the given value without consuming input.
   *
   * This is an alias for `Parser.lift` that follows the monadic naming convention.
   * It's the "return" or "pure" operation for the Parser monad, injecting a plain
   * value into the parser context.
   *
   * @param a - The value to wrap in a successful parser
   * @returns {Parser<A>} A parser that always succeeds with the given value
   * @template A The type of the value being lifted
   *
   * @example
   * ```ts
   * // Always succeed with a constant value
   * const always42 = Parser.pure(42);
   * always42.parse("any input") // succeeds with 42
   *
   * // Use in flatMap to wrap values
   * const parser = number().flatMap(n =>
   *   n > 0 ? Parser.pure(n) : Parser.fail({ message: "Must be positive" })
   * );
   * ```
   */
  static pure = <A>(a: A): Parser<A> =>
    new Parser(state => Parser.succeed(a, state));

  /**
   * Creates a new parser that lazily evaluates the given function.
   * This is useful for creating recursive parsers.
   *
   * @param fn - A function that returns a parser
   * @returns {Parser<T>} A new parser that evaluates the function when parsing
   * @template T The type of value produced by the parser
   *
   * @example
   * ```ts
   * // Create a recursive parser for nested parentheses
   * const parens: Parser<string> = Parser.lazy(() =>
   *   between(
   *     char('('),
   *     char(')'),
   *     parens
   *   )
   * )
   * ```
   */
  static lazy<T>(fn: () => Parser<T>): Parser<T> {
    return new Parser(state => {
      const parser = fn();
      return parser.run(state);
    });
  }

  /**
   * Combines this parser with another parser, returning both results as a tuple.
   *
   * This is a fundamental sequencing operation that runs two parsers in order.
   * If either parser fails, the entire operation fails. The results are returned
   * as a tuple containing both parsed values.
   *
   * @param parserB - The second parser to run after this one
   * @returns {Parser<[T, B]>} A parser that produces a tuple of both results
   * @template B The type of value produced by the second parser
   *
   * @example
   * ```ts
   * // Parse a coordinate pair
   * const coordinate = number().zip(number().trimLeft(comma));
   * coordinate.parse("10, 20") // succeeds with [10, 20]
   *
   * // Parse a key-value pair
   * const keyValue = identifier().zip(number().trimLeft(colon));
   * keyValue.parse("age:30") // succeeds with ["age", 30]
   *
   * // Combine multiple parsers
   * const triple = number()
   *   .zip(number().trimLeft(comma))
   *   .zip(number().trimLeft(comma))
   *   .map(([[a, b], c]) => [a, b, c]);
   * triple.parse("1, 2, 3") // succeeds with [1, 2, 3]
   * ```
   */
  zip<B>(parserB: Parser<B>): Parser<[T, B]> {
    return new Parser(state => {
      const { result: a, state: stateA } = this.run(state);
      if (Either.isLeft(a)) {
        return {
          result: a as unknown as Either<[T, B], ParseErrorBundle>,
          state: stateA
        };
      }
      const { result: b, state: stateB } = parserB.run(stateA);
      if (Either.isLeft(b)) {
        return {
          result: b as unknown as Either<[T, B], ParseErrorBundle>,
          state: stateB
        };
      }
      return Parser.succeed([a.right, b.right], stateB);
    });
  }

  /**
   * Sequences this parser with another, keeping only the second result.
   *
   * This is useful when you need to parse something but only care about what
   * comes after it. The first parser must succeed for the second to run, but
   * its result is discarded.
   *
   * @param parserB - The parser whose result will be kept
   * @returns {Parser<B>} A parser that produces only the second result
   * @template B The type of value produced by the second parser
   *
   * @example
   * ```ts
   * // Parse a value after a label
   * const labeledValue = string("value:").then(number());
   * labeledValue.parse("value:42") // succeeds with 42
   *
   * // Skip whitespace before parsing
   * const trimmedNumber = whitespace().then(number());
   * trimmedNumber.parse("   123") // succeeds with 123
   *
   * // Parse the body after a keyword
   * const functionBody = keyword("function").then(identifier()).then(block());
   * ```
   */
  then<B>(parserB: Parser<B>): Parser<B> {
    return this.zip(parserB).map(([_, b]) => b);
  }

  /**
   * Alias for `then` - sequences parsers and keeps the right result.
   *
   * This alias follows the naming convention from applicative functors where
   * "zipRight" means to combine two values but keep only the right one.
   *
   * @see {@link then} for details and examples
   */
  zipRight = this.then;

  /**
   * Sequences this parser with another, keeping only the first result.
   *
   * This is useful when you need to parse something that must be present but
   * whose value you don't need. Common uses include parsing required delimiters
   * or terminators.
   *
   * @param parserB - The parser to run but whose result will be discarded
   * @returns {Parser<T>} A parser that produces only the first result
   * @template B The type of value produced by the second parser (discarded)
   *
   * @example
   * ```ts
   * // Parse a statement and discard the semicolon
   * const statement = expression().thenDiscard(char(';'));
   * statement.parse("x + 1;") // succeeds with the expression, semicolon discarded
   *
   * // Parse a quoted string and discard the closing quote
   * const quotedContent = char('"').then(stringUntil('"')).thenDiscard(char('"'));
   *
   * // Parse array elements and discard separators
   * const element = number().thenDiscard(optional(char(',')));
   * ```
   */
  thenDiscard<B>(parserB: Parser<B>): Parser<T> {
    return this.zip(parserB).map(([a, _]) => a);
  }

  /**
   * Alias for `thenDiscard` - sequences parsers and keeps the left result.
   *
   * This alias follows the naming convention from applicative functors where
   * "zipLeft" means to combine two values but keep only the left one.
   *
   * @see {@link thenDiscard} for details and examples
   */
  zipLeft = this.thenDiscard;

  /**
   * Makes this parser usable in generator syntax for cleaner sequential parsing.
   *
   * This iterator implementation allows parsers to be used with `yield*` in
   * generator functions, enabling a more imperative style of parser composition
   * that can be easier to read for complex sequential parsing.
   *
   * @returns {Generator<Parser<T>, T, any>} A generator that yields this parser and returns its result
   * @internal
   */
  *[Symbol.iterator](): Generator<Parser<T>, T, any> {
    return yield this;
  }

  /**
   * Adds a tap point to observe the current state and result during parsing.
   * Useful for debugging parser behavior.
   *
   * @example
   * ```ts
   * const parser = parser(function* () {
   *   const name = yield* identifier();
   *   yield* char(':');
   *   const value = yield* number();
   *   return { name, value };
   * });
   * parser.tap(({ state, result }) => {
   *   console.log(`Parsed ${result} at position ${state.pos}`);
   * });
   * ```
   *
   * @param callback - Function called with current state and result
   * @returns {Parser<T>} The same parser with the tap point added
   */
  tap(
    callback: (args: { state: ParserState; result: ParserOutput<T> }) => void
  ): Parser<T> {
    return new Parser(state => {
      const result = this.run(state);
      callback({ state, result });
      return result;
    });
  }

  static gen = <T>(f: () => Generator<Parser<any>, T, any>): Parser<T> =>
    new Parser<T>(state => {
      const iterator = f();
      let current = iterator.next();
      let currentState: ParserState = state;
      while (!current.done) {
        const { result, state: updatedState } = current.value.run(currentState);
        if (Either.isLeft(result)) {
          // const hasFatalError = result.left.errors.some(e => e.tag === "Fatal");
          // const isCommitted = updatedState?.committed || state?.committed;
          // TODO: actually use hasFatalError and isCommitted to determine if we should continue or not
          return {
            result: result as unknown as Either<T, ParseErrorBundle>,
            state: updatedState
          };
        }
        currentState = updatedState;
        current = iterator.next(result.right);
      }
      return Parser.succeed(current.value, currentState);
    });

  trim(parser: Parser<any>) {
    return parser.then(this).thenDiscard(parser);
  }

  trimLeft(parser: Parser<any>): Parser<T> {
    return parser.then(this);
  }

  trimRight(parser: Parser<any>): Parser<T> {
    return this.thenDiscard(parser);
  }

  /**
   * Adds a label to this parser for better error messages
   * @param name - The label name to add to the context stack
   * @returns {Parser<T>} A new parser with the label added
   */
  label(name: string): Parser<T> {
    return new Parser(state => {
      const newState = {
        ...state,
        context: {
          ...state,
          labelStack: [name, ...(state.labelStack || [])]
        }
      };

      const result = this.run(newState);

      if (Either.isLeft(result.result)) {
        return ParserOutput(
          state,
          Either.left(
            new ParseErrorBundle(
              [
                // Convert generic errors to labeled expectations
                {
                  tag: "Expected",
                  span: Span(state),
                  items: [name],
                  context: newState.labelStack || []
                }
              ],
              state.source
            )
          )
        );
      }

      return result;
    });
  }

  /**
   * Helper for creating semantic expectations with both label and error message
   * @param description - The description for both the label and error message
   * @returns {Parser<T>} A new parser with both labeling and error message
   */
  expect(description: string): Parser<T> {
    return new Parser<T>(state => {
      const output = this.run(state);
      if (Either.isLeft(output.result)) {
        return Parser.fail(
          {
            message: `Expected ${description}`
          },
          output.state
        );
      }
      return output;
    });
  }

  /**
   * Helper for creating semantic expectations with both label and error message
   * @param errorBundle - The error bundle containing the errors to be displayed
   * @param state - The current parser state
   * @returns {ParserOutput<never>} A parser output with the error bundle and the current state
   * @internal
   */
  static failRich(
    errorBundle: { errors: ParseError[] },
    state: ParserState
  ): ParserOutput<never> {
    const bundle = new ParseErrorBundle(
      errorBundle.errors,
      // state?.source ?? state.remaining
      state.source
    );

    return ParserOutput(state, Either.left(bundle));
  }

  /**
   * Commits to the current parsing path, preventing backtracking beyond this point.
   *
   * Once a parser is committed, if it fails later in the sequence, the error won't
   * backtrack to try other alternatives in a `choice` or `or` combinator. This leads
   * to more specific error messages instead of generic "expected one of" errors.
   *
   * @returns {Parser<T>} A new parser that sets the commit flag after successful parsing
   *
   * @example
   * ```ts
   * // Use commit after matching a keyword to ensure specific error messages
   * const ifStatement = parser(function* () {
   *   yield* keyword("if")
   *   yield* commit()  // After seeing "if", we know it's an if statement
   *   yield* char('(').expect("opening parenthesis after 'if'")
   *   const condition = yield* expression
   *   yield* char(')').expect("closing parenthesis")
   *   const body = yield* block
   *   return { type: "if", condition, body }
   * })
   *
   * // In a choice, commit prevents backtracking
   * const statement = choice([
   *   ifStatement,
   *   whileStatement,
   *   assignment
   * ])
   *
   * // Input: "if x > 5 {}"  (missing parentheses)
   * // Without commit: "Expected if, while, or assignment"
   * // With commit: "Expected opening parenthesis after 'if'"
   * ```
   *
   * @example
   * ```ts
   * // Commit can be chained with other methods
   * const jsonObject = char('{')
   *   .commit()  // Once we see '{', it must be an object
   *   .then(whitespace)
   *   .then(objectContent)
   *   .expect("valid JSON object")
   * ```
   *
   * @see {@link commit} - Standalone function version
   * @see {@link cut} - Alias with Prolog-style naming
   */
  commit = (): Parser<T> =>
    new Parser(state => {
      const result = this.run(state);
      if (Either.isRight(result.result)) {
        return ParserOutput(
          { ...result.state, committed: true },
          result.result
        );
      }
      return result;
    });

  /**
   * Creates an atomic parser that either fully succeeds or resets to the original state.
   *
   * This is useful for "all-or-nothing" parsing where you want to try a complex
   * parser but not consume any input if it fails. The parser acts as a transaction -
   * if any part fails, the entire parse is rolled back.
   *
   * @returns {Parser<T>} A new parser that resets state on failure
   *
   * @example
   * ```ts
   * // Without atomic - partial consumption on failure
   * const badParser = parser(function* () {
   *   yield* string("foo")
   *   yield* string("bar")  // If this fails, "foo" is already consumed
   * })
   *
   * // With atomic - no consumption on failure
   * const goodParser = parser(function* () {
   *   yield* string("foo")
   *   yield* string("bar")  // If this fails, we reset to before "foo"
   * }).atomic()
   * ```
   *
   * @example
   * ```ts
   * // Useful for trying complex alternatives
   * const value = or(
   *   // Try to parse as a complex expression
   *   expression.atomic(),
   *   // If that fails completely, try as a simple literal
   *   literal
   * )
   * ```
   *
   * @example
   * ```ts
   * // Lookahead parsing without consumption
   * const startsWithKeyword = or(
   *   string("function").atomic(),
   *   string("const").atomic(),
   *   string("let").atomic()
   * ).map(() => true).or(Parser.succeed(false))
   * ```
   *
   * @see {@link atomic} - Standalone function version
   */
  atomic(): Parser<T> {
    return new Parser(state => {
      const result = this.run(state);
      if (Either.isLeft(result.result)) {
        // On failure, return the error but with the original state
        return ParserOutput(state, result.result);
      }
      return result;
    });
  }
}

export const parser = Parser.gen;

// /**
//  * Creates a parser that fails with an Expected error.
//  * Used when specific tokens or patterns were expected.
//  *
//  * @param items - Array of expected items (tokens, patterns, etc.)
//  * @param found - What was actually found (optional)
//  * @returns A parser that always fails with an Expected error
//  *
//  * @example
//  * ```ts
//  * Parser.expected([")", "]"], "{")  // Expected ) or ], found {
//  * Parser.expected(["identifier"])   // Expected identifier
//  * ```
//  */
// static expected(items: string[], found?: string): Parser<never> {
//   return new Parser(state => {
//     const error: ParseErr = {
//       tag: "Expected",
//       span: createSpan(state),
//       items,
//       found,
//       context: state?.labelStack ?? []
//     };
//     return Parser.failRich({ errors: [error] }, state);
//   });
// }

// /**
//  * Creates a parser that fails with an Unexpected error.
//  * Used when unexpected input was encountered.
//  *
//  * @param found - What was found that wasn't expected
//  * @param hints - Optional hints for the user
//  * @returns A parser that always fails with an Unexpected error
//  *
//  * @example
//  * ```ts
//  * Parser.unexpected("}", ["Expected closing paren"])
//  * Parser.unexpected("123", ["Identifiers cannot start with numbers"])
//  * ```
//  */
// static unexpected(found: string, hints?: string[]): Parser<never> {
//   return new Parser(state => {
//     const error: ParseErr = {
//       tag: "Unexpected",
//       span: createSpan(state),
//       found,
//       hints,
//       context: state?.labelStack ?? []
//     };
//     return Parser.failRich({ errors: [error] }, state);
//   });
// }

// static selectRight<A>(p: Parser<A>): Parser<Either<A, never>> {
//   return p.flatMap(a => Parser.lift(Either.right(a)));
// }

// static selectLeft<A>(p: Parser<A>): Parser<Either<never, A>> {
//   return p.flatMap(a => Parser.lift(Either.left(a)));
// }

// /**
//  * Creates a parser that fails with a specific error type and options.
//  * This is the most powerful error creation method for complex cases.
//  *
//  * @param options - Configuration object for the error
//  * @returns A parser that always fails with the specified error
//  *
//  * @example
//  * ```ts
//  * Parser.failWith({
//  *   type: "expected",
//  *   items: ["identifier", "number"],
//  *   found: "string literal",
//  *   hints: ["Variables must start with letters"]
//  * })
//  *
//  * Parser.failWith({
//  *   type: "fatal",
//  *   message: "Cannot recover from this syntax error"
//  * })
//  * ```
//  */
// static failWith(options: {
//   type: "expected" | "unexpected" | "custom" | "fatal";
//   message?: string;
//   items?: string[];
//   found?: string;
//   hints?: string[];
// }): Parser<never> {
//   return new Parser(state => {
//     const span = createSpan(state);
//     const context = state?.labelStack ?? [];

//     let error: ParseError;
//     switch (options.type) {
//       case "expected":
//         error = {
//           tag: "Expected",
//           span,
//           items: options.items ?? [],
//           found: options.found,
//           context
//         };
//         break;
//       case "unexpected":
//         error = {
//           tag: "Unexpected",
//           span,
//           found: options.found ?? "",
//           hints: options.hints,
//           context
//         };
//         break;
//       case "custom":
//         error = {
//           tag: "Custom",
//           span,
//           message: options.message ?? "",
//           hints: options.hints,
//           context
//         };
//         break;
//       case "fatal":
//         error = {
//           tag: "Fatal",
//           span,
//           message: options.message ?? "",
//           context
//         };
//         break;
//     }

//     return Parser.failRich({ errors: [error] }, state);
//   });
// }

// static error(
//   message: string,
//   hints?: string[],
//   stateCallback?: (state: ParserState) => ParserState
// ): Parser<never> {
//   return new Parser(state => {
//     return Parser.failRich(
//       {
//         errors: [
//           ParseError.custom({
//             span: createSpan(state),
//             message,
//             hints,
//             context: state?.labelStack ?? []
//           })
//         ]
//       },
//       stateCallback ? stateCallback(state) : state
//     );
//   });
// }

// withTrace(label: string): Parser<T> {
//   return new Parser<T>(state => {
//     if (!state?.debug) {
//       return this.run(state);
//     }
//     return debug(this, label).run(state);
//   });
// }

// /**
//  * Adds an error message to the parser
//  * @param makeMessage - A function that returns an error message
//  * @returns A new parser with the error message added
//  */
// withError(
//   makeMessage: (errorCtx: {
//     error: ParseErrorBundle;
//     state: ParserState;
//   }) => string
// ): Parser<T> {
//   return new Parser<T>(state => {
//     const output = this.run(state);
//     if (Either.isLeft(output.result)) {
//       return Parser.fail(
//         {
//           message: makeMessage({
//             error: output.result.left,
//             state: output.state
//           })
//         },
//         output.state
//       );
//     }
//     return output;
//   });
// }

// type BindResult<T, K extends string, B> = Clean<T & { [k in K]: B }>;
// bind<K extends string, B>(
//   k: K,
//   other: Parser<B> | ((a: T) => Parser<B>)
// ): Parser<BindResult<T, K, B>> {
//   return new Parser<BindResult<T, K, B>>(state => {
//     const { result: resultA, state: stateA } = this.run(state);
//     if (Either.isLeft(resultA)) {
//       return {
//         result: resultA as unknown as Either<
//           BindResult<T, K, B>,
//           ParseErrorBundle
//         >,
//         state: stateA
//       };
//     }
//     const nextParser = other instanceof Parser ? other : other(resultA.right);
//     const { result: resultB, state: stateB } = nextParser.run(stateA);
//     if (Either.isLeft(resultB)) {
//       return {
//         result: resultB as unknown as Either<
//           BindResult<T, K, B>,
//           ParseErrorBundle
//         >,
//         state: stateB
//       };
//     }
//     return Parser.succeed(
//       { ...resultA.right, [k]: resultB.right } as BindResult<T, K, B>,
//       stateB
//     );
//   });
// }

// static Do = Parser.pure({});
