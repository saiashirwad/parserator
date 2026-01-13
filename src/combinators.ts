/**
 * @fileoverview
 */

import { Either } from "./either";
import { type ParseError, type ParseErrorBundle } from "./errors";
import {
  MutableParserContext,
  PARSE_FAILED,
  type FastPathResult
} from "./fastpath";
import { Parser, parser } from "./parser";
import {
  ParserOutput,
  State,
  type ParserState,
  type SourcePosition
} from "./state";

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
  new Parser(state => {
    const { result } = par.run(state);
    if (result._tag === "Right") {
      return Parser.succeed(result.right, state);
    }
    return Parser.succeed(undefined, state);
  });

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
    const { result, state: newState } = par.run(state);
    if (result._tag === "Right") {
      // if (parser.options?.name) {
      //   const message = `Found ${parser.options.name} when it should not appear here`;
      //   return Parser.fail({ message, expected: [] }, newState);
      // }
      return Parser.fail(
        {
          message: "Expected not to follow",
          expected: [],
          found: State.charAt(state)
        },
        newState
      );
    }
    return Parser.succeed(true, state);
  });
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
  new Parser(
    state => {
      if (State.startsWith(state, str)) {
        return Parser.succeed(str, State.consume(state, str.length));
      }

      const message =
        `Expected '${str}', ` +
        `but found '${State.remaining(state).slice(0, str.length)}'`;

      return Parser.fail(
        {
          message,
          expected: [str],
          found: State.remaining(state).slice(0, str.length)
        },
        state
      );
    },
    ctx => {
      if (ctx.startsWith(str)) {
        ctx.advance(str.length);
        return str;
      }

      const found = ctx.remaining().slice(0, str.length);
      ctx.recordError({
        tag: "Expected",
        items: [str],
        found: found || undefined,
        span: ctx.span(0),
        context: ctx.labelStack
      });
      return PARSE_FAILED;
    }
  );

/**
 * Creates a parser that matches an exact string literal type.
 * Similar to string parser but preserves the literal type information.
 *
 * @param str - The string literal to match
 * @returns {Parser<T>} A parser that matches and consumes the exact string with preserved type
 * ```ts
 * const parser = narrowedString("hello") // Parser<"hello">
 * parser.run("hello world") // Right(["hello", {...}])
 * parser.run("goodbye") // Left(error)
 * ```
 */
export const narrowedString = <const T extends string>(str: T): Parser<T> =>
  string(str) as any;

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
export const char = <T extends string>(ch: T): Parser<T> =>
  new Parser(
    state => {
      if (ch.length !== 1) {
        return Parser.fail(
          { message: "Incorrect usage of char parser.", expected: [ch] },
          state
        );
      }
      if (State.charAt(state) === ch) {
        return Parser.succeed(ch, State.consume(state, 1));
      }

      const nextChar = State.charAt(state);

      return Parser.fail(
        {
          message: `Expected ${ch}${nextChar ? `but found ${nextChar}` : ""}`,
          expected: [ch],
          found: State.charAt(state)
        },
        state
      );
    },
    ctx => {
      if (ch.length !== 1) {
        ctx.recordError({
          tag: "Custom",
          message: "Incorrect usage of char parser.",
          span: ctx.span(0),
          context: ctx.labelStack
        });
        return PARSE_FAILED;
      }

      if (ctx.charAt() === ch) {
        ctx.advance(1);
        return ch;
      }

      const nextChar = ctx.charAt();
      ctx.recordError({
        tag: "Expected",
        items: [ch],
        found: nextChar || undefined,
        span: ctx.span(0),
        context: ctx.labelStack
      });
      return PARSE_FAILED;
    }
  );

/**
 * A parser that matches any single alphabetic character (a-z, A-Z).
 *
 * ```ts
 * const parser = alphabet
 * parser.run("abc") // Right(["a", {...}])
 * parser.run("123") // Left(error)
 * ```
 */
export const alphabet = new Parser(state => {
  if (State.isAtEnd(state)) {
    return Parser.fail(
      { message: "Unexpected end of input", expected: [] },
      state
    );
  }
  const first = State.charAt(state);
  if (first && /^[a-zA-Z]$/.test(first)) {
    return Parser.succeed(first, State.consume(state, 1));
  }
  const message = `Expected alphabetic character, but got '${first}'`;
  return Parser.fail(
    { message, expected: [], found: State.charAt(state) },
    state
  );
});

/**
 * A parser that matches any single digit character (0-9).
 *
 * ```ts
 * const parser = digit
 * parser.run("123") // Right(["1", {...}])
 * parser.run("abc") // Left(error)
 * ```
 */
export const digit = new Parser(state => {
  if (State.isAtEnd(state)) {
    return Parser.fail(
      { message: "Unexpected end of input", expected: [] },
      state
    );
  }
  const first = State.charAt(state);
  if (first && /^[0-9]$/.test(first)) {
    return Parser.succeed(first, State.consume(state, 1));
  }
  const message = `Expected digit, but got '${first}'`;
  return Parser.fail(
    { message, expected: [], found: State.charAt(state) },
    state
  );
});

/**
 * Creates a parser that matches zero or more occurrences of elements separated by a separator.
 *
 * @param sepParser - Parser for the separator between elements
 * @param parser - Parser for the elements
 * @returns {Parser<T[]>} A parser that produces an array of matched elements
 *
 * ```ts
 * const parser = sepBy(char(','), digit)
 * parser.run("1,2,3") // Right([["1", "2", "3"], {...}])
 * parser.run("") // Right([[], {...}])
 * ```
 */
// TODO: fix this
export function sepBy<S, T>(
  parser: Parser<T>,
  sepParser: Parser<S>
): Parser<T[]> {
  return new Parser(state => {
    const results: T[] = [];
    let currentState = state;

    const { result: firstResult, state: firstState } = parser.run(currentState);
    if (firstResult._tag === "Left") {
      return Parser.succeed([], state);
    }

    results.push(firstResult.right);
    currentState = firstState;

    while (true) {
      const { result: sepResult, state: sepState } =
        sepParser.run(currentState);
      if (sepResult._tag === "Left") {
        break;
      }

      const { result: itemResult, state: itemState } = parser.run(sepState);
      if (itemResult._tag === "Left") {
        break;
      }

      results.push(itemResult.right);
      currentState = itemState;
    }

    return Parser.succeed(results, currentState);
  });
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
    const first = yield* par;
    const rest = yield* many0(sepParser.then(par));
    return [first, ...rest];
  });
}

/**
 * Creates a parser that matches content between two string delimiters.
 *
 * @param start - The opening delimiter string
 * @param end - The closing delimiter string
 * @param par - The parser for the content between delimiters
 * @returns {Parser<T>} A parser that matches content between delimiters
 *
 * ```ts
 * const parser = between(char('('), char(')'), digit)
 * parser.run('(5)') // Right(['5', {...}])
 * parser.run('5') // Left(error)
 * parser.run('(5') // Left(error: Expected closing delimiter)
 * ```
 */
export function between<T>(
  start: Parser<any>,
  end: Parser<any>,
  par: Parser<T>
): Parser<T> {
  return parser(function* () {
    yield* start;
    const content = yield* par;
    yield* end.expect(`closing delimiter`);
    return content;
  });
}

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
      );
    }
    return Parser.succeed(State.charAt(state), State.consume(state, 1));
  });
}

/**
 * Internal helper function for creating repetition parsers.
 *
 * @param count - Minimum number of repetitions required
 * @returns {(parser: Parser<T>, separator?: Parser<S>) => Parser<T[]>} A function that creates a parser matching multiple occurrences
 */
function many_<S, T>(
  count: number
): (parser: Parser<T>, separator?: Parser<S>) => Parser<T[]> {
  return (parser: Parser<T>, separator?: Parser<S>): Parser<T[]> => {
    return new Parser(
      state => {
        const results: T[] = [];
        let currentState = state;

        while (true) {
          const itemResult = parser.run({
            ...currentState,
            committed: false
          });
          if (itemResult.result._tag === "Left") {
            if (itemResult.state?.committed) {
              return itemResult as unknown as typeof itemResult & {
                result: Either<T[], ParseErrorBundle>;
              };
            }

            if (results.length >= count) {
              return Parser.succeed(results, currentState);
            }
            const message = `Expected at least ${count} occurrences, but only found ${results.length}`;
            return Parser.fail({ message, expected: [] }, itemResult.state);
          }

          const { result: value, state: newState } = itemResult;
          results.push(value.right);

          if (newState.offset <= currentState.offset) {
            throw new Error("Parser did not advance - infinite loop prevented");
          }
          currentState = newState as ParserState;

          if (separator) {
            const { result: sepResult, state } = separator.run(currentState);
            if (sepResult._tag === "Left") {
              break;
            }
            if (state.offset <= currentState.offset) {
              throw new Error(
                "Separator parser did not advance - infinite loop prevented"
              );
            }
            currentState = state as ParserState;
          }
        }

        if (results.length >= count) {
          return Parser.succeed(results, currentState);
        }

        const message = `Expected at least ${count} occurrences, but only found ${results.length}`;
        return Parser.fail({ message, expected: [] }, currentState);
      },
      ctx => {
        const results: T[] = [];
        const startOffset = ctx.offset;

        while (true) {
          const prevOffset = ctx.offset;
          const result =
            parser.runFast ?
              parser.runFast(ctx)
            : (() => {
                const output = parser.run({
                  source: ctx.source,
                  offset: ctx.offset,
                  line: ctx.line,
                  column: ctx.column,
                  committed: ctx.committed,
                  labelStack: ctx.labelStack
                });

                if (output.result._tag === "Left") {
                  if (output.state.offset > ctx.errorOffset) {
                    ctx.error = output.result.left.errors[0] || null;
                    ctx.errorOffset = output.state.offset;
                  }
                  return PARSE_FAILED;
                }

                ctx.offset = output.state.offset;
                ctx.line = output.state.line;
                ctx.column = output.state.column;
                ctx.committed = output.state.committed || false;
                ctx.labelStack = output.state.labelStack || [];
                return output.result.right;
              })();

          if (result === PARSE_FAILED) {
            if (results.length >= count) {
              return results;
            }
            ctx.recordError({
              tag: "Custom",
              message: `Expected at least ${count} occurrences, but only found ${results.length}`,
              span: ctx.span(0),
              context: ctx.labelStack
            });
            return PARSE_FAILED;
          }

          results.push(result);

          if (ctx.offset <= prevOffset) {
            throw new Error("Parser did not advance - infinite loop prevented");
          }

          if (separator) {
            const sepPrevOffset = ctx.offset;
            const sepResult =
              separator.runFast ?
                separator.runFast(ctx)
              : (() => {
                  const output = separator.run({
                    source: ctx.source,
                    offset: ctx.offset,
                    line: ctx.line,
                    column: ctx.column,
                    committed: ctx.committed,
                    labelStack: ctx.labelStack
                  });

                  if (output.result._tag === "Left") {
                    return PARSE_FAILED;
                  }

                  ctx.offset = output.state.offset;
                  ctx.line = output.state.line;
                  ctx.column = output.state.column;
                  ctx.committed = output.state.committed || false;
                  ctx.labelStack = output.state.labelStack || [];
                  return output.result.right;
                })();

            if (sepResult === PARSE_FAILED) {
              break;
            }

            if (ctx.offset <= sepPrevOffset) {
              throw new Error(
                "Separator parser did not advance - infinite loop prevented"
              );
            }
          }
        }

        if (results.length >= count) {
          return results;
        }

        ctx.recordError({
          tag: "Custom",
          message: `Expected at least ${count} occurrences, but only found ${results.length}`,
          span: ctx.span(0),
          context: ctx.labelStack
        });
        return PARSE_FAILED;
      }
    );
  };
}

/**
 * Creates a parser that matches zero or more occurrences of the input parser.
 *
 * @param parser - The parser to repeat
 * @returns {Parser<T[]>} A parser that produces an array of all matches
 */
export const many0 = <S, T>(
  parser: Parser<T>,
  separator?: Parser<S>
): Parser<T[]> => many_<S, T>(0)(parser, separator);

/**
 * Parses zero or more occurrences of a parser (alias for many0).
 *
 * @param parser - The parser to repeat
 * @returns {Parser<T[]>} A parser that produces an array of parsed elements
 */
export const many = <T>(parser: Parser<T>): Parser<T[]> => many0(parser);

/**
 * Creates a parser that matches one or more occurrences of the input parser.
 *
 * @param parser - The parser to repeat
 * @returns {Parser<T[]>} A parser that produces an array of all matches (at least one)
 */
export const many1 = <S, T>(
  parser: Parser<T>,
  separator?: Parser<S>
): Parser<T[]> => many_<S, T>(1)(parser, separator);

/**
 * Creates a parser that matches at least n occurrences of the input parser.
 *
 * @param parser - The parser to repeat
 * @param n - Number of required repetitions
 * @returns {Parser<T[]>} A parser that produces an array of at least n matches
 */
export const manyN = <S, T>(
  parser: Parser<T>,
  n: number,
  separator?: Parser<S>
): Parser<T[]> => many_<S, T>(n)(parser, separator);

/**
 * Creates a parser that matches exactly n occurrences of the input parser.
 *
 * @param parser - The parser to repeat
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
    const results = yield* manyN(par, n, separator);
    if (results.length !== n) {
      const message = `Expected exactly ${n} occurrences, but found ${results.length}`;
      return yield* Parser.fatal(message);
    }
    return results;
  });

/**
 * Internal helper function for creating skipping repetition parsers.
 *
 * @param count - Minimum number of repetitions required
 * @returns {(parser: Parser<T>) => Parser<undefined>} A function that creates a parser skipping multiple occurrences
 */
const skipMany_ =
  <T>(count: number): ((parser: Parser<T>) => Parser<undefined>) =>
  (parser: Parser<T>): Parser<undefined> =>
    new Parser(state => {
      let currentState = state;
      let successes = 0;

      while (true) {
        const { result, state: newState } = parser.run(currentState);
        if (result._tag === "Left") {
          break;
        }

        // Check that parser advanced - prevent infinite loops
        if (newState.offset <= currentState.offset) {
          throw new Error("Parser did not advance - infinite loop prevented");
        }

        successes++;
        currentState = newState as ParserState;
      }

      if (successes >= count) {
        return Parser.succeed(undefined, currentState);
      }
      const message = `Expected at least ${count} occurrences, but only found ${successes}`;
      return Parser.fail({ message, expected: [] }, state);
    });

/**
 * Creates a parser that skips zero or more occurrences of the input parser.
 *
 * @param parser - The parser to skip
 * @returns {Parser<undefined>} A parser that skips all matches
 */
export const skipMany0 = <T>(parser: Parser<T>): Parser<undefined> =>
  skipMany_<T>(0)(parser);

/**
 * Creates a parser that skips one or more occurrences of the input parser.
 *
 * @param parser - The parser to skip
 * @returns {Parser<undefined>} A parser that skips all matches (requires at least one)
 */
export const skipMany1 = <T>(parser: Parser<T>): Parser<undefined> =>
  skipMany_<T>(1)(parser);

/**
 * Creates a parser that skips exactly n occurrences of the input parser.
 *
 * @param parser - The parser to skip
 * @param n - Number of required repetitions to skip
 * @returns A parser that skips exactly n matches
 */
export const skipManyN = <T>(parser: Parser<T>, n: number) =>
  skipMany_<T>(n)(parser);

/**
 * Creates a parser that skips input until the given parser succeeds.
 *
 * @param parser - The parser to look for
 * @returns A parser that skips input until a match is found
 */
export function skipUntil<T>(parser: Parser<T>): Parser<undefined> {
  return new Parser(state => {
    let currentState = state;

    while (!State.isAtEnd(currentState)) {
      const { result, state: newState } = parser.run(currentState);
      if (result._tag === "Right") {
        return Parser.succeed(undefined, newState);
      }
      currentState = State.consume(currentState, 1);
    }

    return Parser.succeed(undefined, currentState);
  });
}

/**
 * Creates a parser that takes input until the given parser succeeds.
 *
 * @param parser - The parser to look for
 * @returns A parser that takes input until a match is found
 */
export function takeUntil<T>(parser: Parser<T>): Parser<string> {
  return new Parser(state => {
    let currentState = state;
    let collected = "";

    while (!State.isAtEnd(currentState)) {
      const { result, state: newState } = parser.run(currentState);
      if (result._tag === "Right") {
        return Parser.succeed(collected, newState);
      }
      collected += State.remaining(currentState)[0];
      currentState = State.consume(currentState, 1);
    }

    return Parser.succeed(collected, currentState);
  });
}

/**
 * Creates a parser that takes input until the given character is found.
 *
 * @param char - The character to look for
 * @returns A parser that takes input until the character is found
 */
export function parseUntilChar(char: string): Parser<string> {
  return new Parser(state => {
    if (char.length !== 1) {
      return Parser.fail(
        {
          message: "Incorrect usage of parseUntilChar parser.",
          expected: [char]
        },
        state
      );
    }
    let currentState = state;
    let collected = "";

    while (!State.isAtEnd(currentState)) {
      if (State.remaining(currentState)[0] === char) {
        return Parser.succeed(collected, currentState);
      }
      collected += State.remaining(currentState)[0];
      currentState = State.consume(currentState, 1);
    }

    const message = `Expected character ${char} but found ${collected}`;
    return Parser.fail({ message, expected: [char] }, currentState);
  });
}

/**
 * A parser that skips any number of space characters.
 */
export const skipSpaces = new Parser(state =>
  Parser.succeed(
    undefined,
    State.consumeWhile(state, char => char === " ")
  )
);

/**
 * Creates a parser that tries multiple parsers in order until one succeeds.
 *
 * @param parsers - Array of parsers to try
 * @returns A parser that succeeds if any of the input parsers succeed
 */
/**
 * Creates a parser that tries each of the given parsers in order until one succeeds.
 *
 * This combinator is commit-aware: if any parser sets the `committed` flag during
 * parsing, no further alternatives will be tried. This enables better error messages
 * by preventing backtracking once we've identified the intended parse path.
 *
 * @param parsers - Array of parsers to try in order
 * @returns {Parser<Parsers[number] extends Parser<infer T> ? T : never>} A parser that succeeds with the first successful parser's result
 *
 * @example
 * ```ts
 * // Basic usage - tries each alternative
 * const value = or(
 *   numberLiteral,
 *   stringLiteral,
 *   booleanLiteral
 * )
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
 *
 * @example
 * ```ts
 * // Error accumulation without commit
 * const config = or(
 *   jsonParser.label("JSON format"),
 *   yamlParser.label("YAML format"),
 *   tomlParser.label("TOML format")
 * )
 * // Errors from all three parsers are accumulated
 * ```
 */
export function or<Parsers extends Parser<any>[]>(
  ...parsers: Parsers
): Parser<Parsers[number] extends Parser<infer T> ? T : never> {
  return new Parser(
    state => {
      const errors: ParseError[] = [];

      for (const parser of parsers) {
        const { result, state: newState } = parser.run(state);

        if (result._tag === "Right") {
          return Parser.succeed(result.right, newState);
        }

        errors.push(...result.left.errors);

        if (newState?.committed && !state?.committed) {
          return Parser.failRich({ errors }, newState);
        }
      }

      return Parser.failRich({ errors }, state);
    },
    ctx => {
      const errors: ParseError[] = [];

      for (const parser of parsers) {
        const snapshot = ctx.snapshot();

        const result =
          parser.runFast ?
            parser.runFast(ctx)
          : (() => {
              const output = parser.run({
                source: ctx.source,
                offset: ctx.offset,
                line: ctx.line,
                column: ctx.column,
                committed: ctx.committed,
                labelStack: ctx.labelStack
              });

              if (output.result._tag === "Left") {
                if (output.state.offset > ctx.errorOffset) {
                  ctx.error = output.result.left.errors[0] || null;
                  ctx.errorOffset = output.state.offset;
                }
                return PARSE_FAILED;
              }

              ctx.offset = output.state.offset;
              ctx.line = output.state.line;
              ctx.column = output.state.column;
              ctx.committed = output.state.committed || false;
              ctx.labelStack = output.state.labelStack || [];
              return output.result.right;
            })();

        if (result !== PARSE_FAILED) {
          return result;
        }

        if (ctx.error) {
          errors.push(ctx.error);
        }

        if (ctx.committed && !snapshot.committed) {
          return PARSE_FAILED;
        }

        ctx.restore(snapshot);
      }

      if (errors.length > 0 && errors[0]) {
        ctx.recordError(errors[0]);
      }
      return PARSE_FAILED;
    }
  );
}

/**
 * Creates a parser that optionally matches the input parser.
 * If the parser fails, returns undefined without consuming input.
 *
 * @param parser - The parser to make optional
 * @returns {Parser<T | undefined>} A parser that either succeeds with a value or undefined
 */
export function optional<T>(parser: Parser<T>): Parser<T | undefined> {
  return new Parser(
    (state: ParserState) => {
      const { result, state: newState } = parser.run(state);
      if (result._tag === "Left") {
        // If the parser committed before failing, propagate the error
        if (newState.committed && !state.committed) {
          return ParserOutput(newState, result);
        }
        return Parser.succeed(undefined, state);
      }
      return Parser.succeed(result.right, newState);
    },
    ctx => {
      const snapshot = ctx.snapshot();
      const wasCommitted = ctx.committed;
      const result =
        parser.runFast ?
          parser.runFast(ctx)
        : (() => {
            const output = parser.run({
              source: ctx.source,
              offset: ctx.offset,
              line: ctx.line,
              column: ctx.column,
              committed: ctx.committed,
              labelStack: ctx.labelStack
            });

            if (output.result._tag === "Left") {
              // Check if committed during parse
              if (output.state.committed && !wasCommitted) {
                // Update ctx to reflect the error state
                ctx.offset = output.state.offset;
                ctx.committed = true;
                if (output.result.left.errors[0]) {
                  ctx.error = output.result.left.errors[0];
                  ctx.errorOffset = output.state.offset;
                }
              }
              return PARSE_FAILED;
            }

            ctx.offset = output.state.offset;
            ctx.line = output.state.line;
            ctx.column = output.state.column;
            ctx.committed = output.state.committed || false;
            ctx.labelStack = output.state.labelStack || [];
            return output.result.right;
          })();

      if (result === PARSE_FAILED) {
        // If committed during the failed parse, propagate the failure
        if (ctx.committed && !wasCommitted) {
          return PARSE_FAILED;
        }
        ctx.restore(snapshot);
        return undefined;
      }
      return result;
    }
  );
}

type SequenceOutput<T extends Parser<any>[], Acc extends any[] = []> =
  T["length"] extends 0 ? Acc
  : T extends [Parser<infer Head extends any>, ...infer Tail extends any[]] ?
    SequenceOutput<Tail, [...Acc, Head]>
  : never;

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
    const results = [];
    for (const parser of parsers) {
      const result = yield* parser;
      results.push(result);
    }
    return results as any;
  });

/**
 * Creates a parser that matches input against a regular expression.
 * The regex must match at the start of the input.
 *
 * @param re - The regular expression to match against
 * @returns {Parser<string>} A parser that matches the regex pattern
 */
export const regex = (re: RegExp): Parser<string> => {
  const stickyRe = new RegExp(re.source, "y");

  return new Parser(
    state => {
      stickyRe.lastIndex = state.offset;
      const match = stickyRe.exec(state.source);
      if (match) {
        const value = match[0];
        return Parser.succeed(value, State.consume(state, value.length));
      }
      const message = `Expected ${re} but found ${State.peek(state, 10)}...`;
      return Parser.fail({ message, expected: [re.toString()] }, state);
    },
    ctx => {
      stickyRe.lastIndex = ctx.offset;
      const match = stickyRe.exec(ctx.source);
      if (match) {
        const value = match[0];
        ctx.advance(value.length);
        return value;
      }
      ctx.recordError({
        tag: "Expected",
        items: [re.toString()],
        found: ctx.remaining().slice(0, 10) || undefined,
        span: ctx.span(0),
        context: ctx.labelStack
      });
      return PARSE_FAILED;
    }
  );
};

export function zip<A, B>(
  parserA: Parser<A>,
  parserB: Parser<B>
): Parser<[A, B]> {
  return parserA.zip(parserB);
}

export function then<A, B>(parserA: Parser<A>, parserB: Parser<B>): Parser<B> {
  return parserA.then(parserB);
}

export const zipRight = then;

export function thenDiscard<A, B>(
  parserA: Parser<A>,
  parserB: Parser<B>
): Parser<A> {
  return parserA.thenDiscard(parserB);
}
export const zipLeft = thenDiscard;

/**
 * Creates a parser that takes input until the given parser would succeed, without consuming the parser.
 *
 * @param parser - The parser to look for
 * @returns A parser that takes input until before a match would be found
 */
export function takeUpto<T>(parser: Parser<T>): Parser<string> {
  return new Parser(state => {
    let currentState = state;
    let collected = "";

    while (!State.isAtEnd(currentState)) {
      const { result } = parser.run(currentState);
      if (result._tag === "Right") {
        return Parser.succeed(collected, currentState);
      }
      collected += State.remaining(currentState)[0];
      currentState = State.consume(currentState, 1);
    }

    return Parser.succeed(collected, currentState);
  });
}

/**
 * Creates a parser that commits to the current parsing path, preventing backtracking.
 *
 * After calling `commit()`, if parsing fails later in the sequence, the parser won't
 * backtrack to try alternatives in a `choice` or `or` combinator. This results in
 * more specific, helpful error messages instead of generic "expected one of" errors.
 *
 * @returns {Parser<void>} A parser that sets the commit flag in the parsing context
 *
 * @example
 * ```ts
 * // Use commit after identifying the type of construct
 * const ifStatement = parser(function* () {
 *   yield* keyword("if")
 *   yield* commit()  // No backtracking after this point
 *   yield* char('(').expect("opening parenthesis after 'if'")
 *   const condition = yield* expression
 *   yield* char(')').expect("closing parenthesis")
 *   const body = yield* block
 *   return { type: "if", condition, body }
 * })
 * ```
 *
 * @example
 * ```ts
 * // Commit in different parsing contexts
 * const jsonParser = parser(function* () {
 *   const firstChar = yield* peekChar
 *
 *   if (firstChar === '{') {
 *     yield* char('{')
 *     yield* commit()  // Definitely parsing an object
 *     return yield* jsonObject
 *   } else if (firstChar === '[') {
 *     yield* char('[')
 *     yield* commit()  // Definitely parsing an array
 *     return yield* jsonArray
 *   }
 *   // ...
 * })
 * ```
 *
 * @example
 * ```ts
 * // Commit with error recovery
 * const statement = choice([
 *   ifStatement,    // Has commit() after "if"
 *   whileStatement, // Has commit() after "while"
 *   forStatement,   // Has commit() after "for"
 *   expression      // No commit, can always fall back to this
 * ])
 *
 * // Input: "if (x > 5 { }"  (missing closing paren)
 * // Result: "Expected closing parenthesis" (not "Expected if, while, for, or expression")
 * ```
 *
 * @see {@link cut} - Alias with Prolog-style naming
 */
export function commit(): Parser<void> {
  return new Parser(state => {
    return Parser.succeed(void 0, {
      ...state,
      committed: true
    }) as any;
  });
}

/**
 * Alias for {@link commit} using Prolog-style naming.
 *
 * The cut operator (!) in Prolog prevents backtracking, similar to how
 * this prevents the parser from trying other alternatives after this point.
 *
 * @example
 * ```ts
 * const prologStyleIf = parser(function* () {
 *   yield* keyword("if")
 *   yield* cut()  // Using Prolog-style naming
 *   yield* char('(')
 *   // ...
 * })
 * ```
 */
export const cut = commit;

/**
 * Creates an atomic parser that either fully succeeds or resets to the original state.
 *
 * This combinator wraps a parser in a transaction-like behavior. If the parser fails
 * at any point, the input position is reset to where it was before the atomic parser
 * started, as if no input was consumed.
 *
 * @param parser - The parser to make atomic
 * @returns {Parser<T>} A new parser with atomic (all-or-nothing) behavior
 *
 * @example
 * ```ts
 * // Try to parse a complex structure without consuming input on failure
 * const functionCall = atomic(
 *   parser(function* () {
 *     const name = yield* identifier
 *     yield* char('(')
 *     const args = yield* sepBy(expression, char(','))
 *     yield* char(')')
 *     return { name, args }
 *   })
 * )
 * ```
 *
 * @example
 * ```ts
 * // Use atomic for lookahead without consumption
 * const nextIsOperator = atomic(
 *   or(
 *     string("++"),
 *     string("--"),
 *     string("+="),
 *     string("-=")
 *   )
 * ).map(() => true).or(Parser.succeed(false))
 * ```
 *
 * @example
 * ```ts
 * // Combine with 'or' for clean alternatives
 * const value = or(
 *   atomic(complexExpression),  // Try complex first
 *   atomic(simpleExpression),   // Then simpler
 *   literal                     // Finally, just a literal
 * )
 *
 * // If complexExpression fails after consuming "foo + ",
 * // atomic ensures we backtrack completely
 * ```
 *
 * @see {@link Parser.atomic} - Instance method version
 */
export function atomic<T>(parser: Parser<T>): Parser<T> {
  return parser.atomic();
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
  return new Parser(state => {
    if (ch.length !== 1) {
      return Parser.fail(
        {
          message: "notChar expects a single character",
          expected: []
        },
        state
      );
    }

    if (State.charAt(state) && State.charAt(state) !== ch) {
      return Parser.succeed(State.charAt(state), State.consume(state, 1));
    }

    return Parser.fail(
      {
        message: `Expected any character except '${ch}'`,
        expected: [`not '${ch}'`],
        found: State.charAt(state)
      },
      state
    );
  });
}

/**
 * Parser that succeeds only at the end of input.
 *
 * @example
 * ```ts
 * const parser = string("hello").then(eof)
 * parser.parse("hello") // Success
 * parser.parse("hello world") // Error: Expected end of input
 * ```
 */
export const eof = new Parser<void>(state => {
  if (State.remaining(state).length === 0) {
    return Parser.succeed(undefined, state);
  }
  return Parser.fail(
    {
      message: "Expected end of input",
      expected: ["end of input"],
      found:
        State.remaining(state).slice(0, 20) +
        (State.remaining(state).length > 20 ? "..." : "")
    },
    state
  );
});

/**
 * Parses exactly n occurrences of a parser.
 *
 * @param n - The exact number of occurrences
 * @param parser - The parser to repeat
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
    const results: T[] = [];
    for (let i = 0; i < n; i++) {
      const result = yield* par;
      results.push(result);
    }
    return results;
  });
}

/**
 * Parses a list with optional trailing separator.
 *
 * @param parser - The parser for list elements
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
  or(
    parser(function* () {
      const elements = yield* sepBy(par, sep);
      yield* optional(sep); // Allow trailing separator
      return elements;
    }),
    Parser.pure([])
  );

export const position: Parser<SourcePosition> = new Parser(state => {
  return ParserOutput(state, Either.right(State.toPosition(state)));
});
