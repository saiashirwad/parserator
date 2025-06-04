import { debug } from "./debug";
import { Either } from "./either";
import { type ParseErr, ParseErrorBundle, createSpan } from "./errors";
import {
  type ParserContext,
  type ParserOptions,
  type ParserOutput,
  type ParserState,
  State
} from "./state";
import type { Prettify } from "./types";

type BindResult<T, K extends string, B> = Prettify<T & { [k in K]: B }>;

export class Parser<T, Ctx = {}> {
  constructor(
    /**
     * @internal
     */
    public run: (state: ParserState<Ctx>) => ParserOutput<T, Ctx>,
    public options?: ParserOptions
  ) {}

  name(name: string) {
    this.options = { ...this.options, name };
    return this;
  }

  static succeed<T, Ctx = {}>(value: T, state: ParserState<Ctx>): ParserOutput<T, Ctx> {
    return { state, result: Either.right(value) };
  }

  static lift = <A, Ctx = {}>(a: A): Parser<A, Ctx> =>
    new Parser(state => Parser.succeed(a, state));

  static liftA2 = <A, B, C>(ma: Parser<A>, mb: Parser<B>, f: (a: A, b: B) => C) =>
    ma.zip(mb).map(args => f(...args));

  static ap = <A, B>(ma: Parser<A>, mf: Parser<(_: A) => B>) => mf.zip(ma).map(([f, a]) => f(a));

  static fail<Ctx = {}>(
    error: { message: string; expected?: string[]; found?: string },
    state: ParserState<Ctx>
  ): ParserOutput<never, Ctx> {
    const span = createSpan({
      pos: { offset: state.pos.offset, line: state.pos.line, column: state.pos.column }
    });

    const parseErr: ParseErr = {
      tag: "Custom",
      span,
      message: error.message,
      context: state.context?.labelStack ?? [],
      hints: []
    };

    const bundle = new ParseErrorBundle([parseErr], state.context?.source ?? state.remaining);

    return { state, result: Either.left(bundle) };
  }

  static error<Ctx = {}>(
    message: string,
    expected: string[] = [],
    stateCallback?: (state: ParserState<Ctx>) => ParserState<Ctx>
  ): Parser<never, Ctx> {
    return new Parser(state => {
      return Parser.fail({ message, expected }, stateCallback ? stateCallback(state) : state);
    });
  }

  static selectRight<A>(p: Parser<A>): Parser<Either<A, never>, {}> {
    return p.flatMap(a => Parser.lift(Either.right(a)));
  }

  static selectLeft<A>(p: Parser<A>): Parser<Either<never, A>, {}> {
    return p.flatMap(a => Parser.lift(Either.left(a)));
  }

  /**
   * Adds an error message to the parser
   * @param makeMessage - A function that returns an error message
   * @returns A new parser with the error message added
   */
  withError(
    makeMessage: (errorCtx: { error: ParseErrorBundle; state: ParserState<Ctx> }) => string
  ): Parser<T, Ctx> {
    return new Parser<T, Ctx>(state => {
      const output = this.run(state);
      if (Either.isLeft(output.result)) {
        return Parser.fail(
          { message: makeMessage({ error: output.result.left, state: output.state }) },
          output.state
        );
      }
      return output;
    }, this.options);
  }

  static fatal<Ctx = {}>(message: string): Parser<never, Ctx> {
    return new Parser(state => {
      const span = createSpan(state);
      const fatalError: ParseErr = {
        tag: "Fatal",
        span,
        message,
        context: state.context?.labelStack ?? []
      };

      return Parser.failRich({ errors: [fatalError] }, state);
    });
  }

  parse(input: string, context = { source: input }): ParserOutput<T, Ctx> {
    const st = State.fromInput(input, context);
    const { result, state } = this.run(State.fromInput(input, context) as any);
    return { result, state };
  }

  withTrace(label: string): Parser<T, Ctx> {
    return new Parser<T, Ctx>(state => {
      if (!state.context?.debug) {
        return this.run(state);
      }
      return debug(this, label).run(state);
    }, this.options);
  }

  parseOrError(input: string, context = { source: input } as ParserContext<Ctx>) {
    const { result } = this.run(State.fromInput(input, context));
    if (Either.isRight(result)) {
      return result.right;
    }
    return result.left;
  }

  parseOrThrow(input: string, context = { source: input } as ParserContext<Ctx>): T {
    const { result } = this.parse(input, context ?? { source: input });

    if (Either.isLeft(result)) {
      throw result.left;
    }
    return result.right;
  }

  map<B>(f: (a: T) => B): Parser<B, Ctx> {
    return new Parser<B, Ctx>(state => {
      const { result, state: newState } = this.run(state);
      if (Either.isLeft(result)) {
        return { state, result: result as unknown as Either<B, ParseErrorBundle> };
      }
      return Parser.succeed(f(result.right), newState);
    });
  }

  flatMap<B>(f: (a: T) => Parser<B, Ctx>): Parser<B, Ctx> {
    return new Parser<B, Ctx>(state => {
      const { result, state: newState } = this.run(state);
      if (Either.isLeft(result)) {
        return { state: newState, result: result as unknown as Either<B, ParseErrorBundle> };
      }
      const nextParser = f(result.right);
      return nextParser.run(newState);
    });
  }

  static pure = <A, Ctx = {}>(a: A): Parser<A, Ctx> =>
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

  zip<B>(parserB: Parser<B, Ctx>): Parser<[T, B], Ctx> {
    return new Parser(state => {
      const { result: a, state: stateA } = this.run(state);
      if (Either.isLeft(a)) {
        return { result: a as unknown as Either<[T, B], ParseErrorBundle>, state: stateA };
      }
      const { result: b, state: stateB } = parserB.run(stateA);
      if (Either.isLeft(b)) {
        return { result: b as unknown as Either<[T, B], ParseErrorBundle>, state: stateB };
      }
      return Parser.succeed([a.right, b.right], stateB);
    });
  }

  then<B>(parserB: Parser<B, Ctx>): Parser<B, Ctx> {
    return this.zip(parserB).map(([_, b]) => b);
  }

  zipRight = this.then;

  thenDiscard<B>(parserB: Parser<B, Ctx>): Parser<T, Ctx> {
    return this.zip(parserB).map(([a, _]) => a);
  }

  zipLeft = this.thenDiscard;

  bind<K extends string, B>(
    k: K,
    other: Parser<B, Ctx> | ((a: T) => Parser<B, Ctx>)
  ): Parser<BindResult<T, K, B>, Ctx> {
    return new Parser<BindResult<T, K, B>, Ctx>(state => {
      const { result: resultA, state: stateA } = this.run(state);
      if (Either.isLeft(resultA)) {
        return {
          result: resultA as unknown as Either<BindResult<T, K, B>, ParseErrorBundle>,
          state: stateA
        };
      }
      const nextParser = other instanceof Parser ? other : other(resultA.right);
      const { result: resultB, state: stateB } = nextParser.run(stateA);
      if (Either.isLeft(resultB)) {
        return {
          result: resultB as unknown as Either<BindResult<T, K, B>, ParseErrorBundle>,
          state: stateB
        };
      }
      return Parser.succeed(
        { ...resultA.right, [k]: resultB.right } as BindResult<T, K, B>,
        stateB
      );
    }, this.options);
  }

  *[Symbol.iterator](): Generator<Parser<T, Ctx>, T, any> {
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
    callback: (args: { state: ParserState<Ctx>; result: ParserOutput<T, Ctx> }) => void
  ): Parser<T, Ctx> {
    return new Parser(state => {
      const result = this.run(state);
      callback({ state, result });
      return result;
    }, this.options);
  }

  static gen = <T, Ctx = unknown>(f: () => Generator<Parser<any, Ctx>, T, any>): Parser<T, Ctx> =>
    new Parser<T, Ctx>(state => {
      const iterator = f();
      let current = iterator.next();
      let currentState: ParserState<Ctx> = state;
      while (!current.done) {
        const { result, state: updatedState } = current.value.run(currentState);
        if (Either.isLeft(result)) {
          // Check if any error is fatal
          const hasFatalError = result.left.errors.some(e => e.tag === "Fatal");

          // Check if we're in a committed state
          const isCommitted = updatedState.context?.committed || state.context?.committed;
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

  trim(parser: Parser<any, Ctx>) {
    return parser.then(this).thenDiscard(parser);
  }

  trimLeft(parser: Parser<any, Ctx>): Parser<T, Ctx> {
    return parser.then(this);
  }

  trimRight(parser: Parser<any, Ctx>): Parser<T, Ctx> {
    return this.thenDiscard(parser);
  }

  /**
   * Adds a label to this parser for better error messages
   * @param name - The label name to add to the context stack
   * @returns A new parser with the label added
   */
  label(name: string): Parser<T, Ctx> {
    return new Parser(state => {
      const newState = {
        ...state,
        context: { ...state.context, labelStack: [name, ...(state.context.labelStack || [])] }
      };

      const result = this.run(newState);

      if (Either.isLeft(result.result)) {
        // Convert generic errors to labeled expectations
        const labeledError: ParseErr = {
          tag: "Expected",
          span: createSpan(state),
          items: [name],
          context: newState.context.labelStack || []
        };

        return Parser.failRich({ errors: [labeledError] }, result.state);
      }

      return result;
    }, this.options);
  }

  /**
   * Helper for creating semantic expectations with both label and error message
   * @param description - The description for both the label and error message
   * @returns A new parser with both labeling and error message
   */
  expect(description: string): Parser<T, Ctx> {
    return this.withError(() => `Expected ${description}`).label(description);
  }

  /**
   * Helper for creating semantic expectations with both label and error message
   * @param errorBundle - The error bundle containing the errors to be displayed
   * @param state - The current parser state
   * @returns A parser output with the error bundle and the current state
   */
  static failRich<Ctx = {}>(
    errorBundle: { errors: ParseErr[] },
    state: ParserState<Ctx>
  ): ParserOutput<never, Ctx> {
    const bundle = new ParseErrorBundle(
      errorBundle.errors,
      state.context?.source ?? state.remaining
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
  commit(): Parser<T, Ctx> {
    return new Parser(state => {
      const result = this.run(state);
      if (Either.isRight(result.result)) {
        return {
          ...result,
          state: {
            ...result.state,
            context: { ...result.state.context, committed: true }
          }
        };
      }
      return result;
    }, this.options);
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
  atomic(): Parser<T, Ctx> {
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
    }, this.options);
  }
}

export const parser = Parser.gen;
