import { build } from "bun"

await build({
	entrypoints: ["./src/index.ts"],
	outdir: "./dist",
	target: "node",
	format: "esm",
	external: ["typescript"],
	sourcemap: "external",
})
