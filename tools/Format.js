import { Transform, TransformStartConfigAndWait, TransformMoveWaitAfterLoop, TransformQuantize, TransformEndLoop, TransformValidate } from "./Transform.js";
import { CommandLabel, CommandJump, CommandWait } from "./Command.js";

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

	toString() {
		const lines = [];
		lines.push(`Track ${this.name}`);
		lines.push(`  Duration: ${this.duration.toFixed(2)} s`);
		lines.push(`  Tick frequency: ${this.tickFrequency} Hz`);
		lines.push(`  Raw data size: ${this.size}`);
		lines.push(`  Max commands per frame: ${this.maxCommandsPerFrame}`);
		if (this.maxCyclesPerFrame)
			lines.push(`  Max CPU cycles per frame: ${this.maxCyclesPerFrame}`);
		return lines.join("\n");
	}
}
