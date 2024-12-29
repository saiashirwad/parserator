import { copyFile } from "node:fs/promises"
import { join } from "node:path"

async function main() {
	// Copy the .d.ts file to .d.cts for CommonJS
	await copyFile(
		join("dist", "index.d.ts"),
		join("dist", "index.d.cts"),
	)
}

main().catch(console.error)
