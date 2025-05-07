import fs from "fs";
import { default as fspath } from "path";
import { ResourceOverride, Resources } from "./Resources.ts";

async function main() {
	let resourcesPath: string | null = null;
	let outputPath: string | null = null;
	let help = false;
	let stats = false;
	let overrides: ResourceOverride[] = [];
	for (let i = 2; i < process.argv.length; i++) {
		const arg = process.argv[i];
		if (arg.startsWith("-")) {
			if (arg == "--help") {
				help = true;
			} else if (arg == "--stats") {
				stats = true;
			} else if (arg == "--set") {
				if (i + 2 >= process.argv.length)
					throw new Error("Missing arguments.");
				overrides.push(new ResourceOverride(process.argv[++i], process.argv[++i]));
			} else {
				throw new Error(`Unsupported option: ${arg}`);
			}
		} else if (!resourcesPath) {
			resourcesPath = arg;
		} else if (!outputPath) {
			outputPath = arg;
		} else {
			throw new Error(`Too many arguments: ${process.argv.slice(i).join(" ")}`);
		}
	}

	help = help || !resourcesPath;

	if (help) {
		console.log(`Usage: node ${process.argv[1]} resources.json output.rep`);
		return 0;
	}

	const resourcesJSON = JSON.parse(await fs.promises.readFile(resourcesPath, { encoding: "utf8" }));
	for (const override of overrides) {
		override.apply(resourcesJSON);
	}

	const resources = await Resources.create(resourcesJSON, fspath.dirname(resourcesPath));
	if (outputPath) {
		await resources.write(outputPath);
	}

	if (stats) {
		console.log(resources.getStats());
	}

	return 0;
}

process.exit(await main());
