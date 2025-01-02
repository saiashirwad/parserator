import { Parser } from "./parser";

export const peekState = new Parser((s) => {
  console.log(s);
  return Parser.succeed(undefined, s);
});

export const peekRemaining = new Parser((s) => {
  console.log(s.remaining);
  return Parser.succeed(s.remaining, s);
});

export const peekAhead = (n: number) =>
  new Parser((s) => {
    console.log(s.remaining.slice(0, n));
    return Parser.succeed(s.remaining.slice(0, n), s);
  });


