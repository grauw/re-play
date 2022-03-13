import { ResourcesLoader, ResourceOverride } from "./Resources.js";

async function main() {
	let resourcesPath = null;
	let outputPath = null;
	let help = false;
	let overrides = [];
	for (let i = 2; i < process.argv.length; i++) {
		const arg = process.argv[i];
		if (arg.startsWith("-")) {
			if (arg == "--help") {
				help = true;
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

	const resources = await new ResourcesLoader(resourcesPath, overrides).parse();
	if (outputPath) {
		await resources.write(outputPath);
	}

	for (const track of resources.tracks) {
		const unusedChannels = track.getUnusedChannels();
		if (unusedChannels.length > 0) {
			console.log(`Warning: Track ${track.name} has unused channels: ${unusedChannels.join(", ")}`);
		}
	}

	return 0;
}

process.exit(await main());
