import { char, parser, regex } from "../src"

const something = parser(function* () {
  yield* char("[")
  while (true) {
    const number = yield* regex(/[0-9]+/)
  }
})
