import { describe, test, expect } from "bun:test";
import {
  Parser,
  alphabet,
  char,
  constString,
  digit,
  many0,
  many1,
  optional,
  or,
  skipUntil,
  string
} from "../src/index";
import { peekAhead } from "../src/utils";
import { Either } from "../dist";

type ModelField = {
  name: string;
  type: string;
  following?: string
};

const whitespace = many0(or(char(" "), char("\n"), char("\t"))).withName('whitespace');
const requiredWhitespace = many1(or(char(" "), char("\n"), char("\t")));
const word = many1(or(alphabet, digit, char("_"))).map(
  (chars) => chars.join(""),
);

const typeParser = Parser.gen(function* () {
  yield* whitespace
  const typeName = yield* word
  const following = yield* optional(or(
    string('[]'),
    char('?')
  ))
  return {
    type: `${typeName}${following ?? ''}`,
    following
  }
})

const basicPrismaTypes = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json']

const fieldParser = Parser.gen(function* () {
  yield* whitespace;
  const name = yield* word;
  yield* whitespace;
  const type = yield* typeParser;
  yield* skipUntil(char("\n"));
  return {
    name,
    ...type,
  };
});


const blockParser = Parser.gen(function* () {
  yield* whitespace;
  const blockName = yield* constString("model");
  yield* requiredWhitespace;
  const name = yield* word;
  yield* whitespace;
  yield* char('{').thenDiscard(whitespace)

  let fields: ModelField[] = []
  while (true) {
    yield* whitespace
    const next = yield* optional(peekAhead(1))
    if (!next) {
      break
    }
    if (next === '@') {
      yield* skipUntil(char('\n'))
    } else if (next === '}') {
      yield* char('}')
      break
    } else {
      const field = yield* fieldParser.thenDiscard(whitespace)
      if (basicPrismaTypes.includes(field.type)) {
        fields.push(field)
      }
    }
  }
  return {
    name,
    fields,
    blockName
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

    @@index([queue, status])
  }
    
  model QueueJobExecution {
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

    @@index([queue, status])
  }
  
  `;


describe("prisma parser", () => {
  test("should parse a prisma schema", () => {
    const parser = many0(blockParser)
    const result = parser.run(contents);
    expect(Either.isRight(result)).toBe(true)
  });
})
