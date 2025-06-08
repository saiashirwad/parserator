// import { debug } from "./debug";
import { Either } from "./either";
import { ParseError, ParseErrorBundle, createSpan } from "./errors";
import { type ParserOutput, type ParserState, State } from "./state";
import type { Clean } from "./types";

type BindResult<T, K extends string, B> = Clean<T & { [k in K]: B }>;

export class Parser<T> {
  constructor(
    /**
     * @internal
     */
    public run: (state: ParserState) => ParserOutput<T>
  ) {}

  // Monad/Applicative

  static succeed<T>(value: T, state: ParserState): ParserOutput<T> {
    return { state, result: Either.right(value) };
  }

  /**
   * Creates a parser that always succeeds with the given value without consuming any input.
   *
   * This is the basic way to inject a value into the parser context. The parser will
   * succeed immediately with the provided value and won't advance the parser state.
   *
   * @param a - The value to lift into the parser context
   * @returns A parser that always succeeds with the given value
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
   * const parser = Parser.gen(function* () {
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
   * @returns A parser that applies the function to the results of both input parsers
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
  ) => ma.zip(mb).map(args => f(...args));

  /**
   * Applies a parser that produces a function to a parser that produces a value.
   *
   * This is the applicative functor's application operator. It allows you to apply
   * functions within the parser context, enabling powerful composition patterns.
   *
   * @param ma - A parser that produces a value
   * @param mf - A parser that produces a function from that value type to another type
   * @returns A parser that applies the parsed function to the parsed value
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
  static ap = <A, B>(ma: Parser<A>, mf: Parser<(_: A) => B>) =>
    mf.zip(ma).map(([f, a]) => f(a));

  // Error handling

  static fail(
    error: { message: string; expected?: string[]; found?: string },
    state: ParserState
  ): ParserOutput<never> {
    const span = createSpan({
      pos: {
        offset: state.pos.offset,
        line: state.pos.line,
        column: state.pos.column
      }
    });

    const parseErr: ParseError = {
      tag: "Custom",
      span,
      message: error.message,
      context: state?.labelStack ?? [],
      hints: []
    };

    const bundle = new ParseErrorBundle(
      [parseErr],
      state?.source ?? state.remaining
    );

    return { state, result: Either.left(bundle) };
  }

  /**
   * Adds an error message to the parser
   * @param makeMessage - A function that returns an error message
   * @returns A new parser with the error message added
   */
  withError(
    makeMessage: (errorCtx: {
      error: ParseErrorBundle;
      state: ParserState;
    }) => string
  ): Parser<T> {
    return new Parser<T>(state => {
      const output = this.run(state);
      if (Either.isLeft(output.result)) {
        return Parser.fail(
          {
            message: makeMessage({
              error: output.result.left,
              state: output.state
            })
          },
          output.state
        );
      }
      return output;
    });
  }

  static fatal(message: string): Parser<never> {
    return new Parser(state => {
      const span = createSpan(state);

      return Parser.failRich(
        {
          errors: [
            {
              tag: "Fatal",
              span,
              message,
              context: state?.labelStack ?? []
            }
          ]
        },
        state
      );
    });
  }

  parse(input: string): ParserOutput<T> {
    // const st = State.fromInput(input);
    const { result, state } = this.run(State.fromInput(input) as any);
    return { result, state };
  }

  parseOrError(input: string) {
    const { result } = this.run(State.fromInput(input));
    if (Either.isRight(result)) {
      return result.right;
    }
    return result.left;
  }

  parseOrThrow(input: string): T {
    const { result } = this.parse(input);

    if (Either.isLeft(result)) {
      throw result.left;
    }
    return result.right;
  }

  map<B>(f: (a: T) => B): Parser<B> {
    return new Parser<B>(state => {
      const { result, state: newState } = this.run(state);
      if (Either.isLeft(result)) {
        return {
          state,
          result: result as unknown as Either<B, ParseErrorBundle>
        };
      }
      return Parser.succeed(f(result.right), newState);
    });
  }

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

  static pure = <A>(a: A): Parser<A> =>
    new Parser(state => Parser.succeed(a, state));

  static Do = Parser.pure({});

  /**
   * Creates a new parser that lazily evaluates the given function.
   * This is useful for creating recursive parsers.
   *
   * @param fn - A function that returns a parser
   * @returns A new parser that evaluates the function when parsing
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

  then<B>(parserB: Parser<B>): Parser<B> {
    return this.zip(parserB).map(([_, b]) => b);
  }

  zipRight = this.then;

  thenDiscard<B>(parserB: Parser<B>): Parser<T> {
    return this.zip(parserB).map(([a, _]) => a);
  }

  zipLeft = this.thenDiscard;

  bind<K extends string, B>(
    k: K,
    other: Parser<B> | ((a: T) => Parser<B>)
  ): Parser<BindResult<T, K, B>> {
    return new Parser<BindResult<T, K, B>>(state => {
      const { result: resultA, state: stateA } = this.run(state);
      if (Either.isLeft(resultA)) {
        return {
          result: resultA as unknown as Either<
            BindResult<T, K, B>,
            ParseErrorBundle
          >,
          state: stateA
        };
      }
      const nextParser = other instanceof Parser ? other : other(resultA.right);
      const { result: resultB, state: stateB } = nextParser.run(stateA);
      if (Either.isLeft(resultB)) {
        return {
          result: resultB as unknown as Either<
            BindResult<T, K, B>,
            ParseErrorBundle
          >,
          state: stateB
        };
      }
      return Parser.succeed(
        { ...resultA.right, [k]: resultB.right } as BindResult<T, K, B>,
        stateB
      );
    });
  }

  *[Symbol.iterator](): Generator<Parser<T>, T, any> {
    return yield this;
  }

  /**
   * Adds a tap point to observe the current state and result during parsing.
   * Useful for debugging parser behavior.
   *
   * @param callback - Function called with current state and result
   * @returns The same parser with the tap point added
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

  static gen = <T, Ctx = unknown>(
    f: () => Generator<Parser<any>, T, any>
  ): Parser<T> =>
    new Parser<T>(state => {
      const iterator = f();
      let current = iterator.next();
      let currentState: ParserState = state;
      while (!current.done) {
        const { result, state: updatedState } = current.value.run(currentState);
        if (Either.isLeft(result)) {
          // Check if any error is fatal
          const hasFatalError = result.left.errors.some(e => e.tag === "Fatal");

          // Check if we're in a committed state
          const isCommitted = updatedState?.committed || state?.committed;
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
   * @returns A new parser with the label added
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
        // Convert generic errors to labeled expectations
        const labeledError: ParseError = {
          tag: "Expected",
          span: createSpan(state),
          items: [name],
          context: newState.labelStack || []
        };

        return Parser.failRich({ errors: [labeledError] }, result.state);
      }

      return result;
    });
  }

  /**
   * Helper for creating semantic expectations with both label and error message
   * @param description - The description for both the label and error message
   * @returns A new parser with both labeling and error message
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
   * @returns A parser output with the error bundle and the current state
   */
  static failRich(
    errorBundle: { errors: ParseError[] },
    state: ParserState
  ): ParserOutput<never> {
    const bundle = new ParseErrorBundle(
      errorBundle.errors,
      state?.source ?? state.remaining
    );

    return { state, result: Either.left(bundle) };
  }

  /**
   * Commits to the current parsing path, preventing backtracking beyond this point.
   *
   * Once a parser is committed, if it fails later in the sequence, the error won't
   * backtrack to try other alternatives in a `choice` or `or` combinator. This leads
   * to more specific error messages instead of generic "expected one of" errors.
   *
   * @returns A new parser that sets the commit flag after successful parsing
   *
   * @example
   * ```ts
   * // Use commit after matching a keyword to ensure specific error messages
   * const ifStatement = Parser.gen(function* () {
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
  commit(): Parser<T> {
    return new Parser(state => {
      const result = this.run(state);
      if (Either.isRight(result.result)) {
        return {
          ...result,
          state: {
            ...result.state,
            context: { ...result.state, committed: true }
          }
        };
      }
      return result;
    });
  }

  /**
   * Creates an atomic parser that either fully succeeds or resets to the original state.
   *
   * This is useful for "all-or-nothing" parsing where you want to try a complex
   * parser but not consume any input if it fails. The parser acts as a transaction -
   * if any part fails, the entire parse is rolled back.
   *
   * @returns A new parser that resets state on failure
   *
   * @example
   * ```ts
   * // Without atomic - partial consumption on failure
   * const badParser = Parser.gen(function* () {
   *   yield* string("foo")
   *   yield* string("bar")  // If this fails, "foo" is already consumed
   * })
   *
   * // With atomic - no consumption on failure
   * const goodParser = Parser.gen(function* () {
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
        return {
          result: result.result,
          state // Reset to original state
        };
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
