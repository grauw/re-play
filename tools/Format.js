import { default as fspath } from "path";
import { Transform, TransformStartConfigAndWait, TransformMoveWaitAfterLoop, TransformQuantize, TransformEndLoop, TransformValidate } from "./Transform.js";
import { CommandWait, CommandLabel, CommandJump, CommandCall, CommandReturn, CommandNop } from "./Command.js";

export class Format {
	constructor(combine = true) {
		this.combine = combine;
	}

	transform(track, options) {
		return this.getTransforms(options).reduce((track, transform) => transform.apply(track), track);
	}

	getTransforms(options, innerTransforms = []) {
		return [
			new TransformMoveWaitAfterLoop(),
			new TransformQuantize(options.tickFrequency, options.waitThreshold, options.tolerance),
			options.targetTickFrequency ? new TransformQuantize(options.targetTickFrequency) : new Transform(),
			...innerTransforms,
			new TransformStartConfigAndWait(),
			new TransformEndLoop()
		];
	}

	transformPost(track, options) {
		return this.getPostTransforms(options).reduce((track, transform) => transform.apply(track), track);
	}

	getPostTransforms(options, innerTransforms = []) {
		return [
			new TransformValidate()
		];
	}

	async loadTrack(path, name) {
		throw new Error("Not implemented.");
	}

	async saveTrack(track, path) {
		throw new Error("Not implemented.");
	}

	async saveTracks(tracks, path) {
		await Promise.all(tracks.map(async track => {
			await this.saveTrack(track, this.combine && tracks.length == 1 ? path : fspath.join(path, this.getFileName(track)));
		}));
	}

	getFileName(track) {
		throw new Error("Not implemented.");
	}

	getSize(command, preceding) {
		return 0;
	}

	getCycles(command, preceding) {
		return 0;
	}

	getStats(track) {
		return new FormatStats(track, this);
	}
}

export class FormatReplay extends Format {
	getFileName(track) {
		return `${track.name}.rep`;
	}
}

export class FormatWrapper extends Format {
	constructor(baseFormat, combine) {
		super(combine);
		this.baseFormat = baseFormat;
	}

	getTransforms(options, innerTransforms) {
		return this.baseFormat ? this.baseFormat.getTransforms(options, innerTransforms) : super.getTransforms(options, innerTransforms);
	}

	getSize(command, preceding) {
		return this.baseFormat ? this.baseFormat.getSize(command, preceding) : super.getSize(command, preceding);
	}

	getCycles(command, preceding) {
		return this.baseFormat ? this.baseFormat.getCycles(command, preceding) : super.getCycles(command, preceding);
	}

	getStats(track) {
		return this.baseFormat ? this.baseFormat.getStats(track) : super.getStats(track);
	}
}

export class FormatStats {
	constructor(track, format) {
		this.name = track.name;
		this.size = FormatStats.getSize(track, format);
		this.duration = FormatStats.getDuration(track);
		this.tickFrequency = track.tickFrequency;
		this.maxCommandsPerFrame = FormatStats.getMaxCommandsPerFrame(track);
		this.maxCyclesPerFrame = FormatStats.getMaxCyclesPerFrame(track, format);
		this.commandCounts = FormatStats.countCommands(track);
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

	static getMaxCyclesPerFrame(track, format) {
		let cycles = 0;
		let maxCycles = 0;
		let lastCommand = undefined;
		let firstFrame = true;
		for (const command of track.commands) {
			cycles += format.getCycles(command, lastCommand);
			if (command instanceof CommandWait) {
				if (firstFrame) {
					firstFrame = false;
				} else {
					maxCycles = Math.max(maxCycles, cycles);
				}
				cycles = 0;
			}
			lastCommand = command;
		}
		return Math.max(maxCycles, cycles);
	}

	static countCommands(track) {
		return {
			total: track.commands.length,
			wait: track.commands.reduce((sum, command) => command instanceof CommandWait ? sum + 1 : sum, 0),
			label: track.commands.reduce((sum, command) => command instanceof CommandLabel ? sum + 1 : sum, 0),
			jump: track.commands.reduce((sum, command) => command instanceof CommandJump ? sum + 1 : sum, 0),
			call: track.commands.reduce((sum, command) => command instanceof CommandCall ? sum + 1 : sum, 0),
			return: track.commands.reduce((sum, command) => command instanceof CommandReturn ? sum + 1 : sum, 0),
			nop: track.commands.reduce((sum, command) => command instanceof CommandNop ? sum + 1 : sum, 0),
		};
	}

	toString() {
		const lines = [];
		lines.push(`Track ${this.name}`);
		lines.push(`  Duration: ${this.duration.toFixed(2)} s`);
		lines.push(`  Tick frequency: ${this.tickFrequency} Hz`);
		lines.push(`  Raw data size: ${this.size}`);
		lines.push(`  Max commands per frame: ${this.maxCommandsPerFrame}`);
		if (this.maxCyclesPerFrame)
			lines.push(`  Max CPU cycles per frame: ${this.maxCyclesPerFrame}`);
		lines.push(`  Command counts: ${this.commandCounts.total} total, ${this.commandCounts.wait} waits, ` +
			`${this.commandCounts.label} labels, ${this.commandCounts.jump} jumps, ${this.commandCounts.call} calls, ` +
			`${this.commandCounts.return} returns, ${this.commandCounts.nop} nops`);
		return lines.join("\n");
	}
}
