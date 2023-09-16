import fs from "fs";
import { default as fspath } from "path";
import { Track } from "./Track.js";
import { FormatOPN } from "./FormatOPN.js";
import { FormatOPL4 } from "./FormatOPL4.js";
import { FormatOPLLPSG } from "./FormatOPLLPSG.js";
import { FormatText } from "./FormatText.js";
import { FormatVGM, FormatVGMOPM, FormatVGMOPNB, FormatVGMOPL4, FormatVGMOPLLPSG } from "./FormatVGM.js";

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
		const tracksAndPaths = this.format.combine ?
			[[this.getCombinedTracks(), path]] :
			this.tracks.map(track => [track, fspath.join(path, `${track.name}.vgm`)]);

		return Promise.all(tracksAndPaths.map(async ([track, path_]) => {
			await this.format.saveTrack(this.format.transformPost(track), path_);
		}));
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

		const format = this.parseFormat(json);

		const tracks = Promise.all(json.tracks.map(async (jsonTrack, index) => {
			const trackPath = fspath.resolve(fspath.dirname(this.path), jsonTrack.path);
			const track = await new FormatVGM().loadTrack(trackPath, jsonTrack.name ?? `${index + 1}`);
			return format.transform(track, { ...json, ...jsonTrack });
		}));

		const resources = new Resources(format);
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
			case "opll-psg":
				return new FormatOPLLPSG(json.bankSize, json.opllFrequency, json.psgFrequency);
			case "text":
				return new FormatText();
			case "text-opn":
				return new FormatText(this.parseFormat({ ...json, format: "opn" }));
			case "text-opl4":
				return new FormatText(this.parseFormat({ ...json, format: "opl4" }));
			case "text-opll-psg":
				return new FormatText(this.parseFormat({ ...json, format: "opll-psg" }));
			case "vgm-opm":
				return new FormatVGMOPM(this.parseFormat({ ...json, format: "opn" }));
			case "vgm-opnb":
				return new FormatVGMOPNB(this.parseFormat({ ...json, format: "opn" }));
			case "vgm-opl4":
				return new FormatVGMOPL4(this.parseFormat({ ...json, format: "opl4" }));
			case "vgm-opll-psg":
				return new FormatVGMOPLLPSG(this.parseFormat({ ...json, format: "opll-psg" }));
			default:
				throw new Error("Unrecognised format.");
		}
	}
}

export class ResourceOverride {
	constructor(path, value) {
		this.path = path.split(".").map(part => /^\d+$/.test(part) ? parseInt(part, 10) : part);
		this.value = value == "true" ? true : value == "false" ? false : value == "null" ? null :
			value == "undefined" ? undefined : /^[\-\d\[\{\"]/.test(value[0]) ? JSON.parse(value) : value;
	}

	apply(json) {
		for (let i = 0; i < this.path.length - 2; i++) {
			json = json[this.path[i]];
		}
		json[this.path.at(-1)] = this.value;
	}
}
