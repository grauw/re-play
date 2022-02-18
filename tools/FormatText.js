import fs from "fs";
import { Format } from "./Format.js";

export class FormatText extends Format {
	async saveTrack(track, path) {
		const data = this.writeTrack(track);
		await fs.promises.writeFile(path, data);
	}

	writeTrack(track) {
		return track.commands.join("\n");
	}
}
