import fs from "fs";
import { Format } from "./Format.js";

export const FORMAT_TEXT = 0x200;

export class FormatText extends Format {
	async saveTrack(track) {
		const data = this.writeTrack(track);
		await fs.promises.writeFile(this.path, data);
	}

	writeTrack(track) {
		return track.commands.join("\n");
	}
}
