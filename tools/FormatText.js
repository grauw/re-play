import fs from "fs";
import { CommandWait } from "./Command.js";
import { Format } from "./Format.js";

export class FormatText extends Format {
	async saveTrack(track, path) {
		const data = this.writeTrack(track);
		await fs.promises.writeFile(path, data);
	}

	writeTrack(track) {
		const lines = [];

		const zeroPad = value => value < 10 ? "0" + Math.floor(value) : Math.floor(value);
		let ticks = 0;
		let commandsCount = 0;
		for (const command of track.commands) {
			commandsCount++;
			if (command instanceof CommandWait) {
				ticks += command.ticks;
				const time = ticks / track.tickFrequency + 0.005;
				lines.push(`${command} - Total: ${ticks}, Time: ${zeroPad(time / 60)}:${zeroPad(time % 60)}.${zeroPad(time * 100 % 100)}, Commands: ${commandsCount}`);
				commandsCount = 0;
			} else {
				lines.push(command);
			}
		}

		return lines.join("\n");
	}
}
