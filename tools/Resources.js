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

	async write(path) {
		await this.format.saveTracks(this.tracks, path);
	}

	getStats() {
		return this.tracks.map(track => this.format.getStats(track)).join("\n");
	}
}

export class ResourcesLoader {
	constructor(path, overrides = []) {
		this.path = path;
		this.overrides = overrides;
	}

	async parse() {
		const json = JSON.parse(await fs.promises.readFile(this.path, { encoding: "utf8" }));
		for (const override of this.overrides) {
			override.apply(json);
		}

		const format = this.parseFormat(json);

		let tracks = await Promise.all(json.tracks.map(async (jsonTrack, index) => {
			const trackPath = fspath.resolve(fspath.dirname(this.path), jsonTrack.path);
			const track = await new FormatVGM().loadTrack(trackPath, jsonTrack.name ?? `${index + 1}`);
			return format.getTransform({ ...json, ...jsonTrack }).apply(track);
		}));

		if (format.combine) {
			tracks = [Track.ofTracksWithIndex("combined", tracks)];
		}

		tracks = tracks.map(track => format.getPostTransform(json).apply(track));

		const resources = new Resources(format);
		for (const track of tracks)
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
		const path = this.path;
		for (let i = 0; i < path.length - 1; i++) {
			if (path[i] in json) {
				json = json[path[i]];
			} else if (typeof path[i + 1] == "number") {
				json = json[path[i]] = [];
			} else if (typeof path[i + 1] == "string") {
				json = json[path[i]] = {};
			} else {
				throw new Error("Invalid path element type.");
			}
		}
		json[path.at(-1)] = this.value;
	}
}
