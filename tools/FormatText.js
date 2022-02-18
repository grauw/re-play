import fs from "fs";
import { checkTypes } from "./utils.js";
import { Format } from "./Format.js";
import { Track } from "./Track.js";

export const FORMAT_TEXT = 0x200;

export class FormatText extends Format {
	async saveTrack(track) {
		checkTypes(arguments, Track);
		await fs.promises.writeFile(this.path, Buffer.from(track.commands.join("\n")));
	}
}
