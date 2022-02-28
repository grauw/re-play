import fs from "fs";
import path from "path";
import { checkTypes } from "./utils.js";
import { Track } from "./audio.js";
import { VGMFile, GNGFile } from "./formats.js";

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
	constructor(tickFrequency, opnbFrequency, opmFrequency) {
		checkTypes(arguments, "number", "number", "number");
		this.tracks = [];
		this.tickFrequency = tickFrequency;
		this.opnbFrequency = opnbFrequency;
		this.opmFrequency = opmFrequency;
	}

	addTrack(track) {
		checkTypes(arguments, Track);
		this.tracks.push(track);
	}

	async write() {
		return Promise.all([
			Promise.all(this.tracks.map(async track => {
				const file = new VGMFile(track.name, `bin/${track.name}-opnb.vgm`);
				file.saveTrackOPNB(track, this.opnbFrequency);
			})),
			Promise.all(this.tracks.map(async track => {
				const file = new VGMFile(track.name, `bin/${track.name}-opm.vgm`);
				file.saveTrackOPM(track, this.opmFrequency);
			})),
			Promise.all(this.tracks.map(async track => {
				const file = new GNGFile(track.name, `bin/${track.name}.gng`);
				file.saveTrack(track, this.tickFrequency, this.opnbFrequency, this.opmFrequency);
			}))
		]);
	}
}

export class ResourcesLoader {
	constructor(path) {
		checkTypes(arguments, "string");
		this.path = path;
	}

	async parse() {
		const json = JSON.parse(await fs.promises.readFile(this.path));

		const resources = new Resources(json.tickFrequency, json.opnbFrequency, json.opmFrequency);

		const tracks = Promise.all(json.tracks.map(async jsonTrack => {
			const trackPath = path.resolve(path.dirname(this.path), jsonTrack.path);
			const track = await new VGMFile(jsonTrack.name, trackPath).loadTrack();
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
}

main().catch(reason => { throw reason; });
