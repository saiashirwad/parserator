import { build } from "bun"

await build({
	entrypoints: ["./index.ts"],
	outdir: "./dist",
	target: "node",
	format: "esm",
	external: ["typescript"],
	sourcemap: "external",
})

const submodules = [
	"combinators",
	"utils",
	"state",
	"parser",
	"lexer",
	"either",
	"debug",
]

for (const module of submodules) {
	await build({
		entrypoints: [`./src/${module}.ts`],
		outdir: "./dist",
		target: "node",
		format: "esm",
		external: ["typescript"],
		sourcemap: "external",
	})
}
