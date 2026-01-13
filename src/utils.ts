/**
 * @fileoverview Utility parsers for inspecting parser state without consuming input.
 * These utilities are useful for debugging and understanding parser behavior.
 */

import { Parser } from "./parser";
import { State } from "./state";

export const peekState = new Parser(s => {
  return Parser.succeed(s, s);
});

export const peekRemaining = new Parser(s => {
  return Parser.succeed(State.remaining(s), s);
});

export const peekAhead = (n: number) =>
  new Parser(s => {
    return Parser.succeed(State.remaining(s).slice(0, n), s);
  });

export const peekLine = new Parser(s => {
  const remaining = State.remaining(s);
  const restOfLine = remaining.slice(0, remaining.indexOf("\n"));
  console.log(restOfLine);
  return Parser.succeed(restOfLine, s);
});

export const peekUntil = (ch: string) =>
  new Parser(s => {
    const remaining = State.remaining(s);
    const index = remaining.indexOf(ch);
    return Parser.succeed(remaining.slice(0, index), s);
  });

type Narrowed<T> =
  T extends readonly any[] ? [...T]
  : T extends Record<string, any> ? { -readonly [K in keyof T]: Narrowed<T[K]> }
  : T;

export function narrow<const T>(value: T): Narrowed<T> {
  return value as any;
}
