import { default as fspath } from "path";
import { Transform, TransformGroup, TransformStartConfigAndWait, TransformMoveWaitAfterLoop, TransformQuantize, TransformEndLoop, TransformCompress, TransformValidate } from "./Transform.js";
import { CommandWait, CommandLabel, CommandJump, CommandCall, CommandReturn, CommandNop } from "./Command.js";
import { Player } from "./Player.js";

export class Format {
	constructor(combine = true) {
		this.combine = combine;
	}

	getTransform(options, innerTransform = new Transform()) {
		return new TransformGroup([
			new TransformMoveWaitAfterLoop(),
			new TransformQuantize(options.tickFrequency, options.waitThreshold, options.tolerance),
			options.targetTickFrequency ? new TransformQuantize(options.targetTickFrequency) : new Transform(),
			innerTransform,
			new TransformStartConfigAndWait(),
			new TransformEndLoop()
		]);
	}

	getPostTransform(options, innerTransform = new Transform()) {
		return new TransformGroup([
			options.compress ? new TransformCompress(this, options.compress.minimumLength) : new Transform(),
			innerTransform,
			new TransformValidate()
		]);
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

	getTransform(options, innerTransform) {
		return this.baseFormat ? this.baseFormat.getTransform(options, innerTransform) : super.getTransform(options, innerTransform);
	}

	getPostTransform(options, innerTransform) {
		return this.baseFormat ? this.baseFormat.getPostTransform(options, innerTransform) : super.getPostTransform(options, innerTransform);
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
		this.tickFrequency = track.tickFrequency;

		this.size = track.commands.reduce((accu, command) =>
			[accu[0] + format.getSize(command, accu[1]), command], [0, undefined])[0];

		this.ticks = 0;
		this.maxCommandsPerFrame = 0;
		this.maxBytesPerFrame = 0;
		this.maxCyclesPerFrame = 0;
		const player = new Player(track);
		for (let i = 0; i < player.indexCount; i++) {
			let frameCommands = 0;
			let frameBytes = 0;
			let frameCycles = 0;
			let lastCommand = null;
			player.play(i);
			player.run((command, index) => {
				if (player.process(command, index)) {
					player.stop();
				}
				frameCommands++;
				frameBytes += format.getSize(command, lastCommand);
				frameCycles += format.getCycles(command, lastCommand);
				if (command instanceof CommandWait) {
					this.ticks += player.playing ? command.ticks : 0;
					this.maxCommandsPerFrame = Math.max(this.maxCommandsPerFrame, frameCommands);
					this.maxBytesPerFrame = Math.max(this.maxBytesPerFrame, frameBytes);
					this.maxCyclesPerFrame = Math.max(this.maxCyclesPerFrame, frameCycles);
					frameCommands = 0;
					frameBytes = 0;
					frameCycles = 0;
				}
				lastCommand = command;
			});
		}
		this.duration = this.ticks / this.tickFrequency;

		this.commandCounts = {
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
		lines.push(`  Data size: ${this.size} bytes`);
		lines.push(`  Duration: ${this.ticks} ticks at ${this.tickFrequency.toFixed(2)} Hz (${this.duration.toFixed(2)} seconds)`);
		lines.push(`  Maxima per frame: ${this.maxCommandsPerFrame} commands, ${this.maxBytesPerFrame} bytes` +
			(this.maxCyclesPerFrame ? `, ${this.maxCyclesPerFrame} CPU cycles` : ``));
		lines.push(`  Command counts: ${this.commandCounts.total} total, ${this.commandCounts.wait} waits, ` +
			`${this.commandCounts.label} labels, ${this.commandCounts.jump} jumps, ${this.commandCounts.call} calls, ` +
			`${this.commandCounts.return} returns, ${this.commandCounts.nop} nops`);
		return lines.join("\n");
	}
}
