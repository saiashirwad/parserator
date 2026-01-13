import { readFileSync } from "fs";
import { join } from "path";
import { bench, run, group } from "./setup";
import { json } from "../examples/json-parser";

const json1kb = readFileSync(
  join(__dirname, "fixtures/json-1kb.json"),
  "utf-8"
);
const json100kb = readFileSync(
  join(__dirname, "fixtures/json-100kb.json"),
  "utf-8"
);
const json1mb = readFileSync(
  join(__dirname, "fixtures/json-1mb.json"),
  "utf-8"
);

group("JSON Parsing - 1KB", () => {
  bench("parserator", () => {
    json.parseOrThrow(json1kb);
  });

  bench("native JSON.parse", () => {
    JSON.parse(json1kb);
  });
});

group("JSON Parsing - 100KB", () => {
  bench("parserator", () => {
    json.parseOrThrow(json100kb);
  });

  bench("native JSON.parse", () => {
    JSON.parse(json100kb);
  });
});

group("JSON Parsing - 1MB", () => {
  bench("parserator", () => {
    json.parseOrThrow(json1mb);
  });

  bench("native JSON.parse", () => {
    JSON.parse(json1mb);
  });
});

run();
