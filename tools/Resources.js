import fs from "fs";
import path from "path";
import { FormatOPN } from "./FormatOPN.js";
import { FormatText } from "./FormatText.js";
import { FormatVGM, FormatVGMOPM, FormatVGMOPNB } from "./FormatVGM.js";

async function main() {
	if (process.argv.length < 3) {
		console.log(`Usage: node ${process.argv[1]} resources.json`);
		process.exit(1);
	}

	const path = process.argv[2];

	const resources = await new ResourcesLoader(path).parse();
	await resources.write();

	for (const track of resources.tracks) {
		const unusedChannels = track.getUnusedChannels();
		if (unusedChannels.length > 0) {
			console.log(`Warning: Track ${track.name} has unused channels: ${unusedChannels.join(", ")}`);
		}
	}
}

export class Resources {
	constructor(format) {
		this.format = format;
		this.tracks = [];
	}

	addTrack(track) {
		this.tracks.push(track);
	}

	async write() {
		if (this.format instanceof FormatOPN) {
			return Promise.all(this.tracks.map(async track => {
				await this.format.saveTrack(track, `bin/${track.name}.rep`);
			}));
		}
		if (this.format instanceof FormatText) {
			return Promise.all(this.tracks.map(async track => {
				await this.format.saveTrack(track, `bin/${track.name}.txt`);
			}));
		}
		if (this.format instanceof FormatVGMOPM) {
			return Promise.all(this.tracks.map(async track => {
				await this.format.saveTrack(track, `bin/${track.name}-opm.vgm`);
			}));
		}
		if (this.format instanceof FormatVGMOPNB) {
			return Promise.all(this.tracks.map(async track => {
				await this.format.saveTrack(track, `bin/${track.name}-opnb.vgm`);
			}));
		}
	}
}

export class ResourcesLoader {
	constructor(path) {
		this.path = path;
	}

	async parse() {
		const json = JSON.parse(await fs.promises.readFile(this.path));

		const resources = new Resources(this.parseFormat(json));

		const tracks = Promise.all(json.tracks.map(async jsonTrack => {
			const trackPath = path.resolve(path.dirname(this.path), jsonTrack.path);
			const track = await new FormatVGM().loadTrack(trackPath, jsonTrack.name);
			const waitThreshold = "waitThreshold" in jsonTrack ? jsonTrack.waitThreshold : json.waitThreshold || 0;
			const channelMapping = "channelMapping" in jsonTrack ? jsonTrack.channelMapping : json.channelMapping || [0, 1, 2, 3, 4, 5, 6, 7];
			const attenuation = "attenuation" in jsonTrack ? jsonTrack.attenuation : json.attenuation || 0;
			return (track
				.moveWaitAfterLoop()
				.removeWaitsUnder(waitThreshold)
				.mapChannels(channelMapping)
				.attenuateVolume(attenuation)
				.frequencyBeforeKeyOn()
				.trimLeadingSilence()
				// .quantise(60)
			);
		}));

		for (const track of await tracks)
			resources.addTrack(track);

		return resources;
	}

	parseFormat(json) {
		switch (json.format) {
			case "opn":
				return new FormatOPN(json.tickFrequency, json.opnbFrequency, json.opmFrequency);
			case "text":
				return new FormatText();
			case "vgm-opm":
				return new FormatVGMOPM(json.opmFrequency);
			case "vgm-opnb":
				return new FormatVGMOPNB(json.opnbFrequency);
			default:
				throw new Error("Unrecognised format.");
		}
	}
}

main().catch(reason => { throw reason; });
