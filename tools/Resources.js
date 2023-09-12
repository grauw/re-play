import fs from "fs";
import path from "path";
import { Track } from "./Track.js";
import { FormatOPN } from "./FormatOPN.js";
import { FormatOPL4 } from "./FormatOPL4.js";
import { FormatOPLLPSG } from "./FormatOPLLPSG.js";
import { FormatText } from "./FormatText.js";
import { FormatVGM, FormatVGMOPM, FormatVGMOPNB, FormatVGMOPL4, FormatVGMOPLLPSG } from "./FormatVGM.js";
import { Transform, TransformStartConfigAndWait, TransformMoveWaitAfterLoop, TransformQuantize, TransformEndLoop } from "./Transform.js";
import { TransformOPNToGenericFM, TransformOPNFrequencyBeforeKeyOn, TransformOPNMapChannels, TransformOPNAttenuateVolume } from "./TransformOPN.js";
import { TransformOPL4FrameSanitizer, TransformOPL4EGToWaveTables, TransformOPL4StripMemory, TransformOPL4WaveMapChannels, TransformOPL4WaveAttenuateVolume } from "./TransformOPL4.js";
import { TransformMultiPCMReduceChannels, TransformMultiPCMToOPL4 } from "./TransformMultiPCM.js";
import { TransformOPLLFrameSanitizer, TransformOPLLMapChannels, TransformOPLLAttenuateVolume } from "./TransformOPLL.js";
import { TransformPSGFrameSanitizer, TransformPSGMapChannels, TransformPSGAttenuateVolume } from "./TransformPSG.js";

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

	async write(path_) {
		if (this.format.combine) {
			const track = this.getCombinedTracks();
			return await this.format.saveTrack(track, path_);
		} else {
			return Promise.all(this.tracks.map(async track => {
				await this.format.saveTrack(track, path.join(path_, `${track.name}.vgm`));
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
			const track = await new FormatVGM().loadTrack(trackPath, jsonTrack.name ?? `${index + 1}`);

			const j = { ...json, ...jsonTrack };
			const transforms = [
				new TransformMoveWaitAfterLoop(),
				new TransformQuantize(j.tickFrequency, j.waitThreshold, j.tolerance),
				j.targetTickFrequency ? new TransformQuantize(j.targetTickFrequency) : new Transform(),
				new TransformOPNToGenericFM(),
				new TransformOPNFrequencyBeforeKeyOn(),
				new TransformMultiPCMReduceChannels(j.reduceChannels),
				new TransformMultiPCMToOPL4(),
				j.stripMode != "all" ? new TransformOPL4EGToWaveTables() : new Transform(),
				new TransformOPL4FrameSanitizer(),
				new TransformOPLLFrameSanitizer(),
				new TransformPSGFrameSanitizer(),
				new TransformOPNMapChannels(j.channelMapping),
				new TransformOPL4WaveMapChannels(j.channelMapping),
				new TransformOPLLMapChannels(j.channelMapping),
				new TransformPSGMapChannels(j.psgChannelMapping),
				new TransformOPNAttenuateVolume(j.attenuation),
				new TransformOPL4WaveAttenuateVolume(j.attenuation),
				new TransformOPLLAttenuateVolume(j.attenuation),
				new TransformPSGAttenuateVolume(j.attenuation),
				new TransformOPL4StripMemory(j.stripMode, j.stripMargin, j.stripPadding),
				new TransformStartConfigAndWait(),
				json.format.startsWith("vgm") ? new Transform() : new TransformEndLoop()
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
			case "opll-psg":
				return new FormatOPLLPSG(json.bankSize, json.opllFrequency, json.psgFrequency);
			case "text":
				return new FormatText();
			case "vgm-opm":
				return new FormatVGMOPM(json.opmFrequency);
			case "vgm-opnb":
				return new FormatVGMOPNB(json.opnbFrequency);
			case "vgm-opl4":
				return new FormatVGMOPL4(json.opl4Frequency);
			case "vgm-opll-psg":
				return new FormatVGMOPLLPSG(json.opllFrequency, json.psgFrequency);
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
