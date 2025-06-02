import { debug } from "./debug"
import { Either } from "./either"
import { type ParseErr, ParseErrorBundle, createSpan } from "./rich-errors"
import {
  type ParserContext,
  type ParserOptions,
  type ParserOutput,
  type ParserState,
  State
} from "./state"
import type { Prettify } from "./types"

type BindResult<T, K extends string, B> = Prettify<
  T & {
    [k in K]: B
  }
>

export class Parser<T, Ctx = {}> {
  constructor(
    /**
     * @internal
     */
    public run: (state: ParserState<Ctx>) => ParserOutput<T, Ctx>,
    public options?: ParserOptions
  ) {}

  name(name: string) {
    this.options = { ...this.options, name }
    return this
  }

  static succeed<T, Ctx = {}>(
    value: T,
    state: ParserState<Ctx>
  ): ParserOutput<T, Ctx> {
    return {
      state,
      result: Either.right(value)
    }
  }

  static lift = <A, Ctx = {}>(a: A): Parser<A, Ctx> =>
    new Parser(state => Parser.succeed(a, state))

  static liftA2 = <A, B, C>(
    ma: Parser<A>,
    mb: Parser<B>,
    f: (a: A, b: B) => C
  ) => ma.zip(mb).map(args => f(...args))

  static ap = <A, B>(ma: Parser<A>, mf: Parser<(_: A) => B>) =>
    mf.zip(ma).map(([f, a]) => f(a))

  static fail<Ctx = {}>(
    error: {
      message: string
      expected?: string[]
      found?: string
    },
    state: ParserState<Ctx>
  ): ParserOutput<never, Ctx> {
    const span = createSpan({
      pos: {
        offset: state.pos.offset,
        line: state.pos.line,
        column: state.pos.column
      }
    })

    const parseErr: ParseErr = {
      tag: "Custom",
      span,
      message: error.message,
      context: state.context?.labelStack ?? [],
      hints: []
    }

    const bundle = new ParseErrorBundle(
      [parseErr],
      state.context?.source ?? state.remaining
    )

    return {
      state,
      result: Either.left(bundle)
    }
  }

  static error<Ctx = {}>(
    message: string,
    expected: string[] = [],
    stateCallback?: (state: ParserState<Ctx>) => ParserState<Ctx>
  ): Parser<never, Ctx> {
    return new Parser(state => {
      return Parser.fail(
        { message, expected },
        stateCallback ? stateCallback(state) : state
      )
    })
  }

  /**
   * Adds an error message to the parser
   * @param makeMessage - A function that returns an error message
   * @returns A new parser with the error message added
   */
  withError(
    makeMessage: (errorCtx: {
      error: ParseErrorBundle
      state: ParserState<Ctx>
    }) => string
  ): Parser<T, Ctx> {
    return new Parser<T, Ctx>(state => {
      const output = this.run(state)
      if (Either.isLeft(output.result)) {
        return Parser.fail(
          {
            message: makeMessage({
              error: output.result.left,
              state: output.state
            })
          },
          output.state
        )
      }
      return output
    }, this.options)
  }

  parse(
    input: string,
    context = { source: input } as ParserContext<Ctx>
  ): ParserOutput<T, Ctx> {
    const { result, state } = this.run(State.fromInput(input, context))
    return { result, state }
  }

  withTrace(label: string): Parser<T, Ctx> {
    return new Parser<T, Ctx>(state => {
      if (!state.context?.debug) {
        return this.run(state)
      }
      return debug(this, label).run(state)
    }, this.options)
  }

  parseOrError(
    input: string,
    context = { source: input } as ParserContext<Ctx>
  ) {
    const { result } = this.run(State.fromInput(input, context))
    if (Either.isRight(result)) {
      return result.right
    }
    return result.left
  }

  parseOrThrow(
    input: string,
    context = { source: input } as ParserContext<Ctx>
  ): T {
    const { result } = this.parse(
      input,
      context ?? {
        source: input
      }
    )

    if (Either.isLeft(result)) {
      throw result.left
    }
    return result.right
  }

  map<B>(f: (a: T) => B): Parser<B, Ctx> {
    return new Parser<B, Ctx>(state => {
      const { result, state: newState } = this.run(state)
      if (Either.isLeft(result)) {
        return {
          state,
          result: result as unknown as Either<B, ParseErrorBundle>
        }
      }
      return Parser.succeed(f(result.right), newState)
    })
  }

  flatMap<B>(f: (a: T) => Parser<B, Ctx>): Parser<B, Ctx> {
    return new Parser<B, Ctx>(state => {
      const { result, state: newState } = this.run(state)
      if (Either.isLeft(result)) {
        return {
          state: newState,
          result: result as unknown as Either<B, ParseErrorBundle>
        }
      }
      const nextParser = f(result.right)
      return nextParser.run(newState)
    })
  }

  static pure = <A>(a: A): Parser<A> =>
    new Parser(state => Parser.succeed(a, state))

  static Do = Parser.pure({})

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
      const parser = fn()
      return parser.run(state)
    })
  }

  zip<B>(parserB: Parser<B, Ctx>): Parser<[T, B], Ctx> {
    return new Parser(state => {
      const { result: a, state: stateA } = this.run(state)
      if (Either.isLeft(a)) {
        return {
          result: a as unknown as Either<[T, B], ParseErrorBundle>,
          state: stateA
        }
      }
      const { result: b, state: stateB } = parserB.run(stateA)
      if (Either.isLeft(b)) {
        return {
          result: b as unknown as Either<[T, B], ParseErrorBundle>,
          state: stateB
        }
      }
      return Parser.succeed([a.right, b.right], stateB)
    })
  }

  then<B>(parserB: Parser<B, Ctx>): Parser<B, Ctx> {
    return this.zip(parserB).map(([_, b]) => b)
  }

  zipRight = this.then

  thenDiscard<B>(parserB: Parser<B, Ctx>): Parser<T, Ctx> {
    return this.zip(parserB).map(([a, _]) => a)
  }

  zipLeft = this.thenDiscard

  bind<K extends string, B>(
    k: K,
    other: Parser<B, Ctx> | ((a: T) => Parser<B, Ctx>)
  ): Parser<BindResult<T, K, B>, Ctx> {
    return new Parser<BindResult<T, K, B>, Ctx>(state => {
      const { result: resultA, state: stateA } = this.run(state)
      if (Either.isLeft(resultA)) {
        return {
          result: resultA as unknown as Either<
            BindResult<T, K, B>,
            ParseErrorBundle
          >,
          state: stateA
        }
      }
      const nextParser = other instanceof Parser ? other : other(resultA.right)
      const { result: resultB, state: stateB } = nextParser.run(stateA)
      if (Either.isLeft(resultB)) {
        return {
          result: resultB as unknown as Either<
            BindResult<T, K, B>,
            ParseErrorBundle
          >,
          state: stateB
        }
      }
      return Parser.succeed(
        { ...resultA.right, [k]: resultB.right } as BindResult<T, K, B>,
        stateB
      )
    }, this.options)
  }

  *[Symbol.iterator](): Generator<Parser<T, Ctx>, T, any> {
    return yield this
  }

  /**
   * Adds a tap point to observe the current state and result during parsing.
   * Useful for debugging parser behavior.
   *
   * @param callback - Function called with current state and result
   * @returns The same parser with the tap point added
   */
  tap(
    callback: (args: {
      state: ParserState<Ctx>
      result: ParserOutput<T, Ctx>
    }) => void
  ): Parser<T, Ctx> {
    return new Parser(state => {
      const result = this.run(state)
      callback({ state, result })
      return result
    }, this.options)
  }

  static gen<T, Ctx = unknown>(
    f: () => Generator<Parser<any, Ctx>, T, any>
  ): Parser<T, Ctx> {
    return new Parser<T, Ctx>(state => {
      const iterator = f()
      let current = iterator.next()
      let currentState: ParserState<Ctx> = state
      while (!current.done) {
        const { result, state: updatedState } = current.value.run(currentState)
        if (Either.isLeft(result)) {
          return {
            result: result as unknown as Either<T, ParseErrorBundle>,
            state: updatedState
          }
        }
        currentState = updatedState
        current = iterator.next(result.right)
      }
      return Parser.succeed(current.value, currentState)
    })
  }

  trim(parser: Parser<any, Ctx>) {
    return parser.then(this).thenDiscard(parser)
  }

  trimLeft(parser: Parser<any, Ctx>): Parser<T, Ctx> {
    return parser.then(this)
  }

  trimRight(parser: Parser<any, Ctx>): Parser<T, Ctx> {
    return this.thenDiscard(parser)
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
        context: {
          ...state.context,
          labelStack: [name, ...(state.context.labelStack || [])]
        }
      }

      const result = this.run(newState)

      if (Either.isLeft(result.result)) {
        // Convert generic errors to labeled expectations
        const labeledError: ParseErr = {
          tag: "Expected",
          span: createSpan(state),
          items: [name],
          context: newState.context.labelStack || []
        }

        return Parser.failRich({ errors: [labeledError] }, result.state)
      }

      return result
    }, this.options)
  }

  /**
   * Helper for creating semantic expectations with both label and error message
   * @param description - The description for both the label and error message
   * @returns A new parser with both labeling and error message
   */
  expect(description: string): Parser<T, Ctx> {
    return this.withError(() => `Expected ${description}`).label(description)
  }

  static failRich<Ctx = {}>(
    errorBundle: { errors: ParseErr[] },
    state: ParserState<Ctx>
  ): ParserOutput<never, Ctx> {
    const bundle = new ParseErrorBundle(
      errorBundle.errors,
      state.context?.source ?? state.remaining
    )

    return {
      state,
      result: Either.left(bundle)
    }
  }
}

export function parser<T, Ctx = unknown>(
  f: () => Generator<Parser<any, Ctx>, T, any>
): Parser<T, Ctx> {
  return new Parser<T, Ctx>(state => {
    const iterator = f()
    let current = iterator.next()
    let currentState: ParserState<Ctx> = state
    while (!current.done) {
      const { result, state: updatedState } = current.value.run(currentState)
      if (Either.isLeft(result)) {
        return {
          result: result as unknown as Either<T, ParseErrorBundle>,
          state: updatedState
        }
      }
      currentState = updatedState
      current = iterator.next(result.right)
    }
    return Parser.succeed(current.value, currentState)
  })
}
