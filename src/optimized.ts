import { Parser } from "./parser";
import {
  MutableParserContext,
  PARSE_FAILED,
  type FastPathResult
} from "./fastpath";
import { ParserOutput, State, type ParserState } from "./state";
import { Either } from "./either";

export function manyChar<T extends string>(ch: T): Parser<T[]> {
  if (ch.length !== 1) {
    throw new Error("manyChar only accepts single characters");
  }

  return new Parser(
    state => {
      const results: T[] = [];
      let currentState = state;

      while (State.charAt(currentState) === ch) {
        results.push(ch);
        currentState = State.consume(currentState, 1);
      }

      return Parser.succeed(results, currentState);
    },
    ctx => {
      const results: T[] = [];
      const source = ctx.source;
      let offset = ctx.offset;

      while (offset < source.length && source[offset] === ch) {
        results.push(ch);
        offset++;
      }

      ctx.offset = offset;
      return results;
    }
  );
}

export function manyDigit(): Parser<string[]> {
  return new Parser(
    state => {
      const results: string[] = [];
      let currentState = state;

      while (true) {
        const ch = State.charAt(currentState);
        if (ch >= "0" && ch <= "9") {
          results.push(ch);
          currentState = State.consume(currentState, 1);
        } else {
          break;
        }
      }

      return Parser.succeed(results, currentState);
    },
    ctx => {
      const results: string[] = [];
      const source = ctx.source;
      let offset = ctx.offset;

      while (offset < source.length) {
        const ch = source[offset];
        if (ch >= "0" && ch <= "9") {
          results.push(ch);
          offset++;
        } else {
          break;
        }
      }

      ctx.offset = offset;
      return results;
    }
  );
}

export function many1Digit(): Parser<string[]> {
  return new Parser(
    state => {
      const results: string[] = [];
      let currentState = state;

      while (true) {
        const ch = State.charAt(currentState);
        if (ch >= "0" && ch <= "9") {
          results.push(ch);
          currentState = State.consume(currentState, 1);
        } else {
          break;
        }
      }

      if (results.length === 0) {
        return Parser.fail(
          { message: "Expected at least one digit", expected: ["digit"] },
          state
        );
      }

      return Parser.succeed(results, currentState);
    },
    ctx => {
      const results: string[] = [];
      const source = ctx.source;
      const startOffset = ctx.offset;
      let offset = ctx.offset;

      while (offset < source.length) {
        const ch = source[offset];
        if (ch >= "0" && ch <= "9") {
          results.push(ch);
          offset++;
        } else {
          break;
        }
      }

      if (results.length === 0) {
        ctx.recordError({
          tag: "Expected",
          items: ["digit"],
          span: ctx.span(0),
          context: ctx.labelStack
        });
        return PARSE_FAILED;
      }

      ctx.offset = offset;
      return results;
    }
  );
}

export function manyAlphabet(): Parser<string[]> {
  return new Parser(
    state => {
      const results: string[] = [];
      let currentState = state;

      while (true) {
        const ch = State.charAt(currentState);
        if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")) {
          results.push(ch);
          currentState = State.consume(currentState, 1);
        } else {
          break;
        }
      }

      return Parser.succeed(results, currentState);
    },
    ctx => {
      const results: string[] = [];
      const source = ctx.source;
      let offset = ctx.offset;

      while (offset < source.length) {
        const ch = source[offset];
        if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")) {
          results.push(ch);
          offset++;
        } else {
          break;
        }
      }

      ctx.offset = offset;
      return results;
    }
  );
}

export function many1Alphabet(): Parser<string[]> {
  return new Parser(
    state => {
      const results: string[] = [];
      let currentState = state;

      while (true) {
        const ch = State.charAt(currentState);
        if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")) {
          results.push(ch);
          currentState = State.consume(currentState, 1);
        } else {
          break;
        }
      }

      if (results.length === 0) {
        return Parser.fail(
          { message: "Expected at least one letter", expected: ["letter"] },
          state
        );
      }

      return Parser.succeed(results, currentState);
    },
    ctx => {
      const results: string[] = [];
      const source = ctx.source;
      let offset = ctx.offset;

      while (offset < source.length) {
        const ch = source[offset];
        if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")) {
          results.push(ch);
          offset++;
        } else {
          break;
        }
      }

      if (results.length === 0) {
        ctx.recordError({
          tag: "Expected",
          items: ["letter"],
          span: ctx.span(0),
          context: ctx.labelStack
        });
        return PARSE_FAILED;
      }

      ctx.offset = offset;
      return results;
    }
  );
}

export function oneOfChars(chars: string): Parser<string> {
  if (chars.length === 0) {
    throw new Error("oneOfChars requires at least one character");
  }

  return new Parser(
    state => {
      const ch = State.charAt(state);
      if (chars.includes(ch)) {
        return Parser.succeed(ch, State.consume(state, 1));
      }
      return Parser.fail(
        {
          message: `Expected one of: ${chars}`,
          expected: chars.split(""),
          found: ch
        },
        state
      );
    },
    ctx => {
      const ch = ctx.charAt();
      if (chars.includes(ch)) {
        ctx.advance(1);
        return ch;
      }
      ctx.recordError({
        tag: "Expected",
        items: chars.split(""),
        found: ch || undefined,
        span: ctx.span(0),
        context: ctx.labelStack
      });
      return PARSE_FAILED;
    }
  );
}

export function manyWhitespace(): Parser<string[]> {
  return new Parser(
    state => {
      const results: string[] = [];
      let currentState = state;

      while (true) {
        const ch = State.charAt(currentState);
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
          results.push(ch);
          currentState = State.consume(currentState, 1);
        } else {
          break;
        }
      }

      return Parser.succeed(results, currentState);
    },
    ctx => {
      const results: string[] = [];
      const source = ctx.source;
      let offset = ctx.offset;

      while (offset < source.length) {
        const ch = source[offset];
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
          results.push(ch);
          offset++;
        } else {
          break;
        }
      }

      ctx.offset = offset;
      return results;
    }
  );
}

export function skipWhitespace(): Parser<void> {
  return new Parser(
    state => {
      let currentState = state;

      while (true) {
        const ch = State.charAt(currentState);
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
          currentState = State.consume(currentState, 1);
        } else {
          break;
        }
      }

      return Parser.succeed(undefined, currentState);
    },
    ctx => {
      const source = ctx.source;
      let offset = ctx.offset;

      while (offset < source.length) {
        const ch = source[offset];
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
          offset++;
        } else {
          break;
        }
      }

      ctx.offset = offset;
      return undefined;
    }
  );
}

export function takeWhileChar(
  predicate: (ch: string) => boolean
): Parser<string> {
  return new Parser(
    state => {
      let currentState = state;
      const chars: string[] = [];

      while (true) {
        const ch = State.charAt(currentState);
        if (ch && predicate(ch)) {
          chars.push(ch);
          currentState = State.consume(currentState, 1);
        } else {
          break;
        }
      }

      return Parser.succeed(chars.join(""), currentState);
    },
    ctx => {
      const source = ctx.source;
      let offset = ctx.offset;
      const start = offset;

      while (offset < source.length && predicate(source[offset])) {
        offset++;
      }

      ctx.offset = offset;
      return source.slice(start, offset);
    }
  );
}

export function takeUntilChar(
  predicate: (ch: string) => boolean
): Parser<string> {
  return takeWhileChar(ch => !predicate(ch));
}

export function takeN(n: number): Parser<string> {
  return new Parser(
    state => {
      const remaining = state.source.length - state.offset;
      if (remaining < n) {
        return Parser.fail(
          {
            message: `Expected ${n} characters but only ${remaining} remaining`,
            expected: [`${n} characters`]
          },
          state
        );
      }
      const value = state.source.slice(state.offset, state.offset + n);
      return Parser.succeed(value, State.consume(state, n));
    },
    ctx => {
      const remaining = ctx.source.length - ctx.offset;
      if (remaining < n) {
        ctx.recordError({
          tag: "Expected",
          items: [`${n} characters`],
          span: ctx.span(0),
          context: ctx.labelStack
        });
        return PARSE_FAILED;
      }
      const value = ctx.source.slice(ctx.offset, ctx.offset + n);
      ctx.advance(n);
      return value;
    }
  );
}

export function anyOfStrings(...strings: string[]): Parser<string> {
  const sorted = [...strings].sort((a, b) => b.length - a.length);

  return new Parser(
    state => {
      for (const str of sorted) {
        if (State.startsWith(state, str)) {
          return Parser.succeed(str, State.consume(state, str.length));
        }
      }
      return Parser.fail(
        {
          message: `Expected one of: ${strings.join(", ")}`,
          expected: strings
        },
        state
      );
    },
    ctx => {
      for (const str of sorted) {
        if (ctx.startsWith(str)) {
          ctx.advance(str.length);
          return str;
        }
      }
      ctx.recordError({
        tag: "Expected",
        items: strings,
        span: ctx.span(0),
        context: ctx.labelStack
      });
      return PARSE_FAILED;
    }
  );
}

export function manyAlphanumeric(): Parser<string[]> {
  return new Parser(
    state => {
      const results: string[] = [];
      let currentState = state;

      while (true) {
        const ch = State.charAt(currentState);
        if (
          (ch >= "a" && ch <= "z") ||
          (ch >= "A" && ch <= "Z") ||
          (ch >= "0" && ch <= "9")
        ) {
          results.push(ch);
          currentState = State.consume(currentState, 1);
        } else {
          break;
        }
      }

      return Parser.succeed(results, currentState);
    },
    ctx => {
      const results: string[] = [];
      const source = ctx.source;
      let offset = ctx.offset;

      while (offset < source.length) {
        const ch = source[offset];
        if (
          (ch >= "a" && ch <= "z") ||
          (ch >= "A" && ch <= "Z") ||
          (ch >= "0" && ch <= "9")
        ) {
          results.push(ch);
          offset++;
        } else {
          break;
        }
      }

      ctx.offset = offset;
      return results;
    }
  );
}

export function many1Alphanumeric(): Parser<string[]> {
  return new Parser(
    state => {
      const results: string[] = [];
      let currentState = state;

      while (true) {
        const ch = State.charAt(currentState);
        if (
          (ch >= "a" && ch <= "z") ||
          (ch >= "A" && ch <= "Z") ||
          (ch >= "0" && ch <= "9")
        ) {
          results.push(ch);
          currentState = State.consume(currentState, 1);
        } else {
          break;
        }
      }

      if (results.length === 0) {
        return Parser.fail(
          {
            message: "Expected at least one alphanumeric character",
            expected: ["alphanumeric"]
          },
          state
        );
      }

      return Parser.succeed(results, currentState);
    },
    ctx => {
      const results: string[] = [];
      const source = ctx.source;
      let offset = ctx.offset;

      while (offset < source.length) {
        const ch = source[offset];
        if (
          (ch >= "a" && ch <= "z") ||
          (ch >= "A" && ch <= "Z") ||
          (ch >= "0" && ch <= "9")
        ) {
          results.push(ch);
          offset++;
        } else {
          break;
        }
      }

      if (results.length === 0) {
        ctx.recordError({
          tag: "Expected",
          items: ["alphanumeric"],
          span: ctx.span(0),
          context: ctx.labelStack
        });
        return PARSE_FAILED;
      }

      ctx.offset = offset;
      return results;
    }
  );
}
