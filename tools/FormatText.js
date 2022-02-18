import fs from "fs";
import { Format } from "./Format.js";

export const FORMAT_TEXT = 0x200;

export class FormatText extends Format {
	async saveTrack(track) {
		await fs.promises.writeFile(this.path, Buffer.from(track.commands.join("\n")));
	}
}
