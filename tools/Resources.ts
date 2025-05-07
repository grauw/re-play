import { default as fspath } from "path";
import type { Format } from "./Format.ts";
import { FormatOPL4 } from "./FormatOPL4.ts";
import { FormatOPLLPSG } from "./FormatOPLLPSG.ts";
import { FormatOPN } from "./FormatOPN.ts";
import { FormatText } from "./FormatText.ts";
import { FormatVGM, FormatVGMOPL4, FormatVGMOPLLPSG, FormatVGMOPM, FormatVGMOPNB } from "./FormatVGM.ts";
import type { FormatJSON, ResourcesJSON, TrackJSON } from "./ResourcesJSON.ts";
import { Track } from "./Track.ts";

export class Resources {
	public readonly format: Format;
	public readonly tracks: Track[];

	constructor(format: Format) {
		this.format = format;
		this.tracks = [];
	}

	addTrack(track: Track) {
		this.tracks.push(track);
	}

	async write(path: string) {
		await this.format.saveTracks(this.tracks, path);
	}

	getStats() {
		return this.tracks.map(track => this.format.getStats(track)).join("\n");
	}

	static async create(json: ResourcesJSON, path = ".") {
		const format = this.createFormat(json);

		let tracks = await Promise.all(json.tracks.map(async (jsonTrack: TrackJSON, index: number) => {
			const trackPath = fspath.resolve(path, jsonTrack.path);
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

	private static createFormat(json: FormatJSON): Format {
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
				return new FormatText(new FormatOPN(json.bankSize, json.opnbFrequency, json.opmFrequency));
			case "text-opl4":
				return new FormatText(new FormatOPL4(json.bankSize, json.opl4Frequency));
			case "text-opll-psg":
				return new FormatText(new FormatOPLLPSG(json.bankSize, json.opllFrequency, json.psgFrequency));
			case "vgm-opm":
				return new FormatVGMOPM(new FormatOPN(json.bankSize, json.opnbFrequency, json.opmFrequency));
			case "vgm-opnb":
				return new FormatVGMOPNB(new FormatOPN(json.bankSize, json.opnbFrequency, json.opmFrequency));
			case "vgm-opl4":
				return new FormatVGMOPL4(new FormatOPL4(json.bankSize, json.opl4Frequency));
			case "vgm-opll-psg":
				return new FormatVGMOPLLPSG(new FormatOPLLPSG(json.bankSize, json.opllFrequency, json.psgFrequency));
			default:
				throw new Error("Unrecognised format.");
		}
	}
}

export class ResourceOverride {
	private readonly path: readonly (number | string)[];
	private readonly value: boolean | number | string | null | undefined;

	constructor(path: string, value: string) {
		this.path = path.split(".").map(part => /^\d+$/.test(part) ? parseInt(part, 10) : part);
		this.value = value == "true" ? true : value == "false" ? false : value == "null" ? null :
			value == "undefined" ? undefined : /^[\-\d\[\{\"]/.test(value[0]) ? JSON.parse(value) : value;
	}

	apply(json: any) {
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
