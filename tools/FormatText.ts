import fs from "fs";
import { CommandWait } from "./Command.ts";
import { type Format, FormatWrapper } from "./Format.ts";
import type { Track } from "./Track.ts";
import { dec } from "./utils.ts";

export class FormatText extends FormatWrapper {
	constructor(baseFormat?: Format) {
		super(baseFormat);
	}

	getFileName(track: Track) {
		return `${track.name}.txt`;
	}

	async saveTrack(track: Track, path: string) {
		const data = this.writeTrack(track);
		await fs.promises.writeFile(path, data);
	}

	writeTrack(track: Track) {
		const lines: string[] = [];

		const zeroPad = (value: number) => dec(Math.floor(value), 2);
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
				lines.push(command.toString());
			}
		}

		return lines.join("\n");
	}
}
