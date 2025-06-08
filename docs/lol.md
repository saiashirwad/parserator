`````

---

### `docs/guide/getting-started.md`

````md

---

### `docs/guide/basic-concepts.md`

````md
# Basic Concepts

| Term               | Meaning in Parserator                                            |
| ------------------ | ---------------------------------------------------------------- |
| **Parser\<T\>**    | An object that, given a string, may produce a **T** or an error. |
| **Combinator**     | A function that accepts parsers and returns a new one.           |
| **State**          | Internal cursor (offset, line, column). You rarely touch it.     |
| **Label / Expect** | Attaches human-friendly text to an error position.               |

## Two kinds of results

```ts
const r = char("A").parse("B");
if (r.result._tag === "Left") {
  console.error(r.result.left.format("plain")); // ← error bundle
} else {
  console.log(r.result.right); // ← success value "A"
}
```
````

Parserator uses a small `Either` type (Right = success, Left = error).
You normally interact with helpers such as **`parseOrThrow`** or let the library format errors for you.&#x20;

````

---

### `docs/guide/parser-combinators.md`
```md
# Everyday Parser Combinators

Below is a “recipe card” you will reach for most days.

| Combinator              | Purpose                              | Mini-example |
|-------------------------|--------------------------------------|--------------|
| `char("x")`             | Match a single exact character       | `char(",")` |
| `string("foo")`         | Match multi-char literal             | `string("let")` |
| `regex(/abc|def/)`      | Match a RegExp (anchored)            | `regex(/[0-9]+/)` |
| `digit`, `letter`       | Ready-made character classes         | `digit` |
| `many(p)`, `many1(p)`   | 0 + / 1 + repetitions                | `many1(digit)` |
| `optional(p)`           | Return `undefined` if absent         | `optional(char("-"))` |
| `or(p, q)` or `p.or(q)` | Try first; if it fails _without consuming_, try second | `letter.or(digit)` |
| `map(fn)`               | Transform the parsed value           | `digit.map(Number)` |
| `expect("…")`           | Better error if this fails           | `char(")").expect("closing paren")` |

## Putting them together

```ts
import { char, digit, many1, parser } from "parserator";

const phoneNumber = parser(function* () {
  yield* char("(");
  const area = yield* many1(digit).expect("area code");
  yield* char(")");
  yield* char(" ");
  const exch = yield* many1(digit);
  yield* char("-");
  const rest = yield* many1(digit);
  return `(${area.join("")}) ${exch.join("")}-${rest.join("")}`;
});
````

This complete example lives in `examples/phone-number.ts` of the repo.&#x20;

Try `phoneNumber.parse("(555) 123-4567")` and watch it succeed—or feed it bad input and enjoy a clear error message.

````

---

### `docs/guide/error-handling.md`
```md
# Error Handling & Diagnostics

Parserator’s error objects carry **where**, **what**, and optional **hints**.

```ts
import { char } from "parserator";

char("]").parseOrThrow("["); // throws → Expected "]", found "["
````

### Rich bundles

Internally, each failure stores:

- `span` – offset, line, column, length
- `tag` – `Expected`, `Unexpected`, `Custom`, or `Fatal`
- optional `hints` – e.g., typos suggestions from Levenshtein distance

Display formats:

```ts
import { ErrorFormatter } from "parserator";

err.format("plain"); // or "ansi" | "html" | "json"
```

The ANSI formatter is already wired in the examples folder, so running any demo will color-print errors nicely on the terminal.&#x20;

````

---

### `docs/guide/advanced-patterns.md`
```md
# Advanced Patterns

You now know enough to parse many real-world formats.
The features below unlock even trickier grammars.

## 1. `commit()` — no backtracking past this point

Useful for performance or when partial matches would be confusing.

```ts
import { parser, char, commit } from "parserator";

const keyValue = parser(function* () {
  yield* char("[");  // once we see '[', we are _sure_ we are in a section
  yield* commit();   // don't backtrack into other rules
  // …
});
````

## 2. `atomic(p)` — “all or nothing”

Ensures that, if `p` fails, the input position rewinds to where it started, so other choices in an `or` stay safe.

## 3. Lazy, recursive parsers

```ts
const expr: Parser<Node> = Parser.lazy(() => or(number, listExpr));
```

## 4. Hint-driven UX

The helper `keywordWithHints` shows typo suggestions (“Did you mean…?”).
See `src/hints.ts` for the implementation and `examples/hints-example.ts` for usage.&#x20;

## 5. Building a tiny language

The `examples/scheme-parser.ts` file walks through a complete mini-Scheme interpreter grammar—great weekend project material.

---

Congratulations! From here you can:

- Browse the **API Reference** for every exported function.
- Read the **Examples** section to copy-paste real parsers.
- File issues or PRs on GitHub—Parserator is MIT-licensed and welcomes contributors.

```

---

#### How to place these files

```

docs/
├─ introduction/
│ └─ what-is-parserator.md
└─ guide/
├─ getting-started.md
├─ basic-concepts.md
├─ parser-combinators.md
├─ error-handling.md
└─ advanced-patterns.md

```

Drop them into your `docs/` directory, run `vitepress dev`, and your new documentation site is ready to explore!
```
`````
