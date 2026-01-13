import { bench, group, run } from "mitata";
import { char, string, many, many1, regex } from "../src/combinators";
import {
  manyChar,
  manyDigit,
  many1Digit,
  manyAlphabet,
  many1Alphabet,
  skipWhitespace,
  oneOfChars
} from "../src/optimized";
import { parser } from "../src/parser";

const input = "hello123world".repeat(100);
const digitInput = "1234567890".repeat(100);
const alphaInput = "abcdefghijklmnopqrstuvwxyz".repeat(100);
const whitespaceInput = "   \t\n  \r\n   ".repeat(100);

group("many(char('x')) vs manyChar('x')", () => {
  const genericMany = many(char("h"));
  const optimizedMany = manyChar("h");

  bench("many(char('h')) - slow-path", () => {
    genericMany.parse(input);
  });

  bench("many(char('h')) - fast-path", () => {
    genericMany.parseFast(input);
  });

  bench("manyChar('h') - optimized", () => {
    optimizedMany.parseFast(input);
  });
});

group("many(digit) vs manyDigit()", () => {
  const digit = regex(/[0-9]/);
  const genericMany = many(digit);
  const optimizedMany = manyDigit();

  bench("many(digit) - slow-path", () => {
    genericMany.parse(digitInput);
  });

  bench("many(digit) - fast-path", () => {
    genericMany.parseFast(digitInput);
  });

  bench("manyDigit() - optimized", () => {
    optimizedMany.parseFast(digitInput);
  });
});

group("many1(digit) vs many1Digit()", () => {
  const digit = regex(/[0-9]/);
  const genericMany = many1(digit);
  const optimizedMany = many1Digit();

  bench("many1(digit) - slow-path", () => {
    genericMany.parse(digitInput);
  });

  bench("many1(digit) - fast-path", () => {
    genericMany.parseFast(digitInput);
  });

  bench("many1Digit() - optimized", () => {
    optimizedMany.parseFast(digitInput);
  });
});

group("many(alphabet) vs manyAlphabet()", () => {
  const alphabet = regex(/[a-zA-Z]/);
  const genericMany = many(alphabet);
  const optimizedMany = manyAlphabet();

  bench("many(alphabet) - slow-path", () => {
    genericMany.parse(alphaInput);
  });

  bench("many(alphabet) - fast-path", () => {
    genericMany.parseFast(alphaInput);
  });

  bench("manyAlphabet() - optimized", () => {
    optimizedMany.parseFast(alphaInput);
  });
});

group("Complex parser comparison", () => {
  const genericParser = parser(function* () {
    yield* many(char(" "));
    const digits = yield* many1(regex(/[0-9]/));
    yield* many(char(" "));
    return digits.join("");
  });

  const optimizedParser = parser(function* () {
    yield* skipWhitespace();
    const digits = yield* many1Digit();
    yield* skipWhitespace();
    return digits.join("");
  });

  const testInput = "   123456   ".repeat(100);

  bench("generic combinators - slow-path", () => {
    genericParser.parse(testInput);
  });

  bench("generic combinators - fast-path", () => {
    genericParser.parseFast(testInput);
  });

  bench("optimized combinators - fast-path", () => {
    optimizedParser.parseFast(testInput);
  });
});

await run();
