import { CommandLabel, CommandJump, CommandWait } from "./Command.js";

export class Format {
	constructor(combine = true) {
		this.combine = combine;
	}

	async loadTrack(path, name) {
		throw new Error("Not implemented.");
	}

	async saveTrack(track, path) {
		throw new Error("Not implemented.");
	}

	getSize(command, preceding) {
		return 0;
	}

	getStats(track) {
		return new FormatStats(track, this);
	}
}

export class FormatStats {
	constructor(track, format) {
		this.name = track.name;
		this.size = FormatStats.getSize(track, format);
		this.duration = FormatStats.getDuration(track);
		this.tickFrequency = track.tickFrequency;
		this.maxCommandsPerFrame = FormatStats.getMaxCommandsPerFrame(track);
	}

	static getSize(track, format) {
		return track.commands.reduce((accu, command) =>
			[accu[0] + format.getSize(command, accu[1]), command], [0, undefined])[0];
	}

	static getDuration(track) {
		return track.commands.reduce((accu, command) =>
			command instanceof CommandWait ? accu + command.ticks : accu, 0) / track.tickFrequency;
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
		lines.push(`  Raw data size: ${this.size}`);
		lines.push(`  Max commands per frame: ${this.maxCommandsPerFrame}`);
		return lines.join("\n");
	}
}
