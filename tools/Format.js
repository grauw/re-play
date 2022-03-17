import { CommandLabel, CommandJump, CommandWait, Command } from "./Command.js";

export class Format {
	async loadTrack(path, name) {
		throw new Error("Not implemented.");
	}

	async saveTrack(track, path) {
		throw new Error("Not implemented.");
	}

	getStats(track) {
		throw new Error("Not implemented.");
	}
}

export class FormatStats {
	constructor(track) {
		this.name = track.name;
		this.duration = FormatStats.getDuration(track);
		this.tickFrequency = track.tickFrequency;
		this.maxCommandsPerFrame = FormatStats.getMaxCommandsPerFrame(track);
	}

	static getDuration(track) {
		return track.commands.reduce((sum, command) =>
			command instanceof CommandWait ? sum + command.ticks : sum, 0) / track.tickFrequency;
	}

	static getMaxCommandsPerFrame(track) {
		let maxCommands = 0;
		let accumulator = 0;
		for (const command of track.commands) {
			if (command instanceof CommandWait || command instanceof CommandJump) {
				maxCommands = Math.max(maxCommands, accumulator + 1);
				accumulator = 0;
			} else if (!(command instanceof CommandLabel)) {
				accumulator++;
			}
		}
		return Math.max(maxCommands, accumulator);
	}

	toString() {
		const lines = [];
		lines.push(`Track ${this.name}`);
		lines.push(`  Duration: ${this.duration.toFixed(2)} s`);
		lines.push(`  Tick frequency: ${this.tickFrequency} Hz`);
		lines.push(`  Max commands per frame: ${this.maxCommandsPerFrame}`);
		return lines.join("\n");
	}
}
