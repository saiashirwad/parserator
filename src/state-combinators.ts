import { Parser } from "./parser";
import { Either } from "./either";

/**
 * Gets the current user state without consuming input
 */
export function getState<S>(): Parser<S, S> {
  return new Parser(state => ({
    state,
    result: Either.right(state.ctx)
  }));
}

/**
 * Sets the user state to a new value
 */
export function setState<S>(newState: S): Parser<void, S> {
  return new Parser(state => ({
    state: { ...state, ctx: newState },
    result: Either.right(undefined)
  }));
}

/**
 * Modifies the user state using a function
 */
export function modifyState<S>(f: (state: S) => S): Parser<void, S> {
  return new Parser(state => ({
    state: { ...state, ctx: f(state.ctx) },
    result: Either.right(undefined)
  }));
}

/**
 * Runs a parser with a specific user state, restoring the original state afterwards
 */
export function withState<T, S>(ctx: S, parser: Parser<T, S>): Parser<T, S> {
  return new Parser(state => {
    const oldUserState = state.ctx;
    const tempState = { ...state, ctx };
    const result = parser.run(tempState);

    // Restore original user state but keep other state changes
    return {
      ...result,
      state: { ...result.state, ctx: oldUserState }
    };
  });
}

/**
 * Creates a parser that provides a view of the state through a lens function
 */
export function zoomState<T, S, S2>(
  lens: (s: S) => S2,
  update: (s: S, s2: S2) => S,
  parser: Parser<T, S2>
): Parser<T, S> {
  return new Parser(state => {
    const innerState = { ...state, ctx: lens(state.ctx) };
    const result = parser.run(innerState as any);

    return {
      ...result,
      state: {
        ...result.state,
        ctx: update(state.ctx, result.state.ctx)
      }
    };
  });
}
