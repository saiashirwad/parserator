import { defineConfig } from "tsup"

export default defineConfig({
	format: ["esm", "cjs"],
	entry: {
		index: "src/index.ts",
	},
	outDir: "dist",
	sourcemap: true,
	clean: true,
	dts: true,
})
