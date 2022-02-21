import fs from "fs";
import path from "path";
import { Track } from "./Track.js";
import { FormatOPN } from "./FormatOPN.js";
import { FormatOPL4Wave } from "./FormatOPL4Wave.js";
import { FormatText } from "./FormatText.js";
import { FormatVGM, FormatVGMOPM, FormatVGMOPNB } from "./FormatVGM.js";

async function main() {
	if (process.argv.length < 4) {
		console.log(`Usage: node ${process.argv[1]} resources.json output.rep`);
		process.exit(1);
	}

	const resourcesPath = process.argv[2];
	const outputPath = process.argv[3];

	const resources = await new ResourcesLoader(resourcesPath).parse();
	await resources.write(outputPath);

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

	getCombinedTracks() {
		return Track.ofTracksWithIndex("combined", this.format.tickFrequency, this.tracks);
	}

	async write(path) {
		if (this.format instanceof FormatOPN) {
			const track = this.getCombinedTracks();
			return await this.format.saveTrack(track, path);
		}
		if (this.format instanceof FormatOPL4Wave) {
			const track = this.getCombinedTracks();
			return await this.format.saveTrack(track, path);
		}
		if (this.format instanceof FormatText) {
			const track = this.getCombinedTracks();
			return await this.format.saveTrack(track, path);
		}
		if (this.format instanceof FormatVGMOPM) {
			return Promise.all(this.tracks.map(async track => {
				await this.format.saveTrack(track, path.replace(/(\.[^\.]*)?$/, `-${track.name}$1`));
			}));
		}
		if (this.format instanceof FormatVGMOPNB) {
			return Promise.all(this.tracks.map(async track => {
				await this.format.saveTrack(track, path.replace(/(\.[^\.]*)?$/, `-${track.name}$1`));
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
			const waitThreshold = "waitThreshold" in jsonTrack ? jsonTrack.waitThreshold : json.waitThreshold;
			const channelMapping = "channelMapping" in jsonTrack ? jsonTrack.channelMapping : json.channelMapping;
			const attenuation = "attenuation" in jsonTrack ? jsonTrack.attenuation : json.attenuation;
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
				return new FormatOPN(json.bankSize, json.tickFrequency, json.opnbFrequency, json.opmFrequency);
			case "opl4-wave":
				return new FormatOPL4Wave(json.bankSize, json.tickFrequency, json.opl4Frequency);
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
