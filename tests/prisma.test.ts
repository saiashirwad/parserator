import { describe, expect, test } from "bun:test"
import {
  Parser,
  alphabet,
  between,
  char,
  constString,
  digit,
  many0,
  many1,
  or,
  skipUntil,
  skipSpaces,
  lookAhead
} from "../src/index";
import { peekAhead, peekRemaining } from "../src/utils";

const validChar = or(
  char("\n"),
  char(" "),
  alphabet,
  digit,
  char("_"),
  char("."),
  char("["),
  char("]"),
  char("@"),
  char("?"),
  char("!"),
  char(":"),
  char("="),
  char("|"),
  char("+"),
  char("-"),
  char("*"),
  char("/"),
  char("%"),
  char("^"),
  char("&"),
  char("|"),
  char("~"),
  char("`"),
  char("\\"),
  char("|"),
  char("~"),
  char("`"),
  char("\\"),
  char("|"),
  char("~"),
  char("`"),
  char("\\"),
);

type ModelField = {
  name: string;
  type: string;
};

type Model = {
  name: string;
  fields: ModelField[];
};

const whitespace = many0(or(char(" "), char("\n"), char("\t"))).withName('whitespace');
const requiredWhitespace = many1(or(char(" "), char("\n"), char("\t")));
const identifier = many1(or(alphabet, digit, char("_"))).map(
  (chars: string[]) => chars.join(""),
);

const fieldParser = Parser.gen(function* () {
  yield* whitespace;
  const name = yield* identifier;
  yield* whitespace;
  const type = yield* identifier;
  yield* skipUntil(char("\n"));
  return {
    name,
    type,
  };
});

const blockParser = Parser.gen(function* () {
  yield* whitespace;
  const blockName = yield* constString("model");
  yield* requiredWhitespace;
  const name = yield* identifier;
  yield* whitespace;

  yield* char('{').thenDiscard(whitespace)
  let fields: ModelField[] = []
  while (true) {
    const field = yield* fieldParser.thenDiscard(whitespace)
    fields.push(field)
    const next = yield* peekAhead(1)
    if (next === '}') {
      yield* char('}')
      break
    }
  }
  return {
    name,
    fields,
  };
});


const contents = `
  model QueueJob {
    id           String              @id
    queue        String
    payload      Json
    status       QueueJobStatus
    errorMessage String?             @db.LongText
    createdAt    DateTime
    attempts     Int
    maxRetries   Int
    scheduledFor DateTime
    executions   QueueJobExecution[]
  }`;


describe("prisma parser", () => {
  test("should parse a prisma schema", () => {
    const result = blockParser.parseOrError(contents);
    console.log(JSON.stringify(result, null, 2));
  });
})


// const lineParser = Parser.gen(function* () {
//   yield* whitespace;
//   const name = yield* identifier;
//   yield* many1(char(' '));
//   const type = yield* identifier;
//   yield* skipSpaces;
//   console.log({ name, type })
// {
//     name,
//     type,
//   };
// });


// describe("something", () => {
//   test("parseLine", () => {
//     const lineText = `queue        String
//     id     String`;
//     const parser = Parser.gen(function* () {
//       const line1 = yield* lineParser;
//       // const line2 = yield* lineParser;
//       // return [line1, line2];
//       return line1
//     })
//     const result = parser.parseOrError(lineText)
//     console.log(JSON.stringify(result, null, 2))
//   })
// })


// describe("object", () => {
//   test('parse a simple flat object', () => {
//     const objString = char('"').then(many1(or(alphabet, digit, char('_')))).thenDiscard(char('"')).map(x => x.join(''))
//     const input = ` {
//       "name": "John",
//       "age": 30
//     }`
//     const parser = Parser.gen(function* () {
//       yield* skipSpaces
//       yield* char('{')
//     })
//     const result = parser.parseOrError(input)
//     console.log(result)
//   })
// })
