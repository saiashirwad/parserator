import { bench, group, run } from "mitata";
import { char, string, many, many1, regex, or } from "../src/combinators";
import {
  manyChar,
  manyDigit,
  many1Digit,
  manyAlphabet,
  many1Alphabet,
  skipWhitespace,
  oneOfChars,
  manyAlphanumeric,
  many1Alphanumeric,
  anyOfStrings,
  takeWhileChar
} from "../src/optimized";
import { parser } from "../src/parser";

const identifierInput = "myVariable123_name".repeat(100);
const keywordInput = "function class const let var".repeat(100);

group("Identifier parser - Full comparison", () => {
  const genericIdentifier = parser(function* () {
    const first = yield* regex(/[a-zA-Z_]/);
    const rest = yield* many(regex(/[a-zA-Z0-9_]/));
    return first + rest.join("");
  });

  const optimizedIdentifier = parser(function* () {
    const first = yield* oneOfChars(
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_"
    );
    const rest = yield* manyAlphanumeric();
    return first + rest.join("");
  });

  bench("baseline (slow-path, generic)", () => {
    genericIdentifier.parse(identifierInput);
  });

  bench("fast-path only", () => {
    genericIdentifier.parseFast(identifierInput);
  });

  bench("fast-path + optimized combinators", () => {
    optimizedIdentifier.parseFast(identifierInput);
  });
});

group("Keyword parser - anyOfStrings optimization", () => {
  const genericKeywords = or(
    string("function"),
    string("class"),
    string("const"),
    string("let"),
    string("var")
  );

  const optimizedKeywords = anyOfStrings(
    "function",
    "class",
    "const",
    "let",
    "var"
  );

  bench("or(string, ...) - slow-path", () => {
    for (let i = 0; i < 100; i++) {
      genericKeywords.parse("function");
    }
  });

  bench("or(string, ...) - fast-path", () => {
    for (let i = 0; i < 100; i++) {
      genericKeywords.parseFast("function");
    }
  });

  bench("anyOfStrings(...) - optimized", () => {
    for (let i = 0; i < 100; i++) {
      optimizedKeywords.parseFast("function");
    }
  });
});

group("Real-world JSON-like parser", () => {
  const genericJsonValue = parser(function* () {
    yield* many(regex(/\s/));
    const firstChar = yield* regex(/[a-zA-Z0-9"]/);
    if (firstChar === '"') {
      const str = yield* many(regex(/[^"]/));
      yield* char('"');
      return '"' + str.join("") + '"';
    } else {
      const rest = yield* many(regex(/[0-9]/));
      return firstChar + rest.join("");
    }
  });

  const optimizedJsonValue = parser(function* () {
    yield* skipWhitespace();
    const firstChar = yield* oneOfChars(
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"'
    );
    if (firstChar === '"') {
      const str = yield* takeWhileChar(ch => ch !== '"');
      yield* char('"');
      return '"' + str + '"';
    } else {
      const rest = yield* manyDigit();
      return firstChar + rest.join("");
    }
  });

  const testValue = '   "hello"';

  bench("generic - slow-path", () => {
    for (let i = 0; i < 1000; i++) {
      genericJsonValue.parse(testValue);
    }
  });

  bench("generic - fast-path", () => {
    for (let i = 0; i < 1000; i++) {
      genericJsonValue.parseFast(testValue);
    }
  });

  bench("optimized - fast-path", () => {
    for (let i = 0; i < 1000; i++) {
      optimizedJsonValue.parseFast(testValue);
    }
  });
});

await run();
