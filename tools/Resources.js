import fs from "fs";
import path from "path";
import { Track } from "./Track.js";
import { FormatOPN } from "./FormatOPN.js";
import { FormatOPL4 } from "./FormatOPL4.js";
import { FormatText } from "./FormatText.js";
import { FormatVGM, FormatVGMOPM, FormatVGMOPNB } from "./FormatVGM.js";
import { TransformAttenuateVolume, TransformMapChannels, TransformMoveWaitAfterLoop,
	TransformQuantize, TransformRemoveWaitsUnder, TransformTrimLeadingSilence, TransformEndLoop } from "./Transform.js";
import { TransformOPNFrequencyBeforeKeyOn } from "./TransformOPN.js";
import { TransformOPL4InsertWaitLoads, TransformOPL4FrameSanitizer } from "./TransformOPL4.js";

export class Resources {
	constructor(format) {
		this.format = format;
		this.tracks = [];
	}

	addTrack(track) {
		this.tracks.push(track);
	}

	getCombinedTracks() {
		return Track.ofTracksWithIndex("combined", this.tracks);
	}

	async write(path) {
		if (this.format instanceof FormatOPN) {
			const track = this.getCombinedTracks();
			return await this.format.saveTrack(track, path);
		}
		if (this.format instanceof FormatOPL4) {
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

	getStats() {
		const tracks = [...this.tracks, this.getCombinedTracks()];
		return tracks.map(track => this.format.getStats(track)).join("\n");
	}
}

export class ResourcesLoader {
	constructor(path, overrides = []) {
		this.path = path;
		this.overrides = overrides;
	}

	async parse() {
		const json = JSON.parse(await fs.promises.readFile(this.path));
		for (const override of this.overrides) {
			override.apply(json);
		}

		const resources = new Resources(this.parseFormat(json));

		const tracks = Promise.all(json.tracks.map(async (jsonTrack, index) => {
			const trackPath = path.resolve(path.dirname(this.path), jsonTrack.path);
			const track = await new FormatVGM().loadTrack(trackPath, jsonTrack.name || `${index + 1}`);

			const transforms = [
				new TransformMoveWaitAfterLoop(),
				new TransformRemoveWaitsUnder(jsonTrack.waitThreshold ?? json.waitThreshold),
				new TransformMapChannels(jsonTrack.channelMapping ?? json.channelMapping),
				new TransformAttenuateVolume(jsonTrack.attenuation ?? json.attenuation),
				new TransformOPNFrequencyBeforeKeyOn(),
				new TransformTrimLeadingSilence(),
				new TransformQuantize(json.tickFrequency),
				new TransformOPL4FrameSanitizer(),
				new TransformOPL4InsertWaitLoads(),
				new TransformEndLoop()
			];

			return transforms.reduce((track, transform) => transform.apply(track), track);
		}));

		for (const track of await tracks)
			resources.addTrack(track);

		return resources;
	}

	parseFormat(json) {
		switch (json.format) {
			case "opn":
				return new FormatOPN(json.bankSize, json.opnbFrequency, json.opmFrequency);
			case "opl4":
				return new FormatOPL4(json.bankSize, json.opl4Frequency);
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

export class ResourceOverride {
	constructor(path, value) {
		this.path = path.split(".").map(part => /^\d+$/.test(part) ? parseInt(part, 10) : part);
		this.value = value == "undefined" ? undefined : JSON.parse(value);
	}

	apply(json) {
		for (let i = 0; i < this.path.length - 2; i++) {
			json = json[this.path[i]];
		}
		json[this.path.at(-1)] = this.value;
	}
}
