import { default as fspath } from "path";
import { type Command, CommandCall, CommandJump, CommandLabel, CommandNop, CommandReturn, CommandWait } from "./Command.ts";
import { Player } from "./Player.ts";
import type { Track } from "./Track.ts";
import { Transform, TransformCompress, TransformEndLoop, TransformGroup, TransformMoveWaitAfterLoop, TransformQuantize, TransformStartConfigAndWait, TransformValidate } from "./Transform.ts";

export type TransformOptions = {
	tickFrequency?: number | "opl4-timer";
	waitThreshold?: number;
	tolerance?: number;
	targetTickFrequency?: number;
	initFrame?: boolean;
};

export type PostTransformOptions = {
	compress?: {
		minimumLength?: number;
	}
	stackCapacity?: number;
};

export class Format {
	public readonly combine: boolean;

	constructor(combine = true) {
		this.combine = combine;
	}

	getTransform(options: TransformOptions, innerTransform: Transform = new Transform()) {
		return new TransformGroup([
			new TransformMoveWaitAfterLoop(),
			new TransformQuantize(options.tickFrequency, options.waitThreshold, options.tolerance),
			options.targetTickFrequency ? new TransformQuantize(options.targetTickFrequency) : new Transform(),
			innerTransform,
			new TransformStartConfigAndWait(options.initFrame),
			new TransformEndLoop()
		]);
	}

	getPostTransform(options: PostTransformOptions, innerTransform: Transform = new Transform()) {
		return new TransformGroup([
			options.compress ? new TransformCompress(this, options.compress.minimumLength) : new Transform(),
			innerTransform,
			new TransformValidate(options.stackCapacity)
		]);
	}

	async loadTrack(path: string, name: string): Promise<Track> {
		throw new Error("Not implemented.");
	}

	async saveTrack(track: Track, path: string) {
		throw new Error("Not implemented.");
	}

	async saveTracks(tracks: readonly Track[], path: string) {
		await Promise.all(tracks.map(async track => {
			await this.saveTrack(track, this.combine && tracks.length == 1 ? path : fspath.join(path, this.getFileName(track)));
		}));
	}

	getFileName(track: Track): string {
		throw new Error("Not implemented.");
	}

	getSize(command: Command, preceding?: Command) {
		return 0;
	}

	getCycles(command: Command, preceding?: Command) {
		return 0;
	}

	getStats(track: Track) {
		return new FormatStats(track, this);
	}
}

export class FormatReplay extends Format {
	getFileName(track: Track) {
		return `${track.name}.rep`;
	}
}

export class FormatWrapper extends Format {
	private readonly baseFormat?: Format;

	constructor(baseFormat?: Format, combine?: boolean) {
		super(combine);
		this.baseFormat = baseFormat;
	}

	getTransform(options: TransformOptions, innerTransform: Transform) {
		return this.baseFormat ? this.baseFormat.getTransform(options, innerTransform) : super.getTransform(options, innerTransform);
	}

	getPostTransform(options: PostTransformOptions, innerTransform: Transform) {
		return this.baseFormat ? this.baseFormat.getPostTransform(options, innerTransform) : super.getPostTransform(options, innerTransform);
	}

	getSize(command: Command, preceding?: Command) {
		return this.baseFormat ? this.baseFormat.getSize(command, preceding) : super.getSize(command, preceding);
	}

	getCycles(command: Command, preceding?: Command) {
		return this.baseFormat ? this.baseFormat.getCycles(command, preceding) : super.getCycles(command, preceding);
	}

	getStats(track: Track) {
		return this.baseFormat ? this.baseFormat.getStats(track) : super.getStats(track);
	}
}

export class FormatStats {
	private name: string;
	private tickFrequency: number;
	private size: number;
	private ticks: number;
	private maxCommandsPerFrame: number;
	private maxBytesPerFrame: number;
	private maxCyclesPerFrame: number;
	private duration: number;
	private commandCounts: {
		total: number;
		wait: number;
		label: number;
		jump: number;
		call: number;
		return: number;
		nop: number;
	};

	constructor(track: Track, format: Format) {
		this.name = track.name;
		this.tickFrequency = track.tickFrequency;

		this.size = track.commands.reduce<[number, Command | undefined]>((accu, command) =>
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
			let lastCommand: Command | undefined;
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
			wait: track.commands.reduce<number>((sum, command) => command instanceof CommandWait ? sum + 1 : sum, 0),
			label: track.commands.reduce<number>((sum, command) => command instanceof CommandLabel ? sum + 1 : sum, 0),
			jump: track.commands.reduce<number>((sum, command) => command instanceof CommandJump ? sum + 1 : sum, 0),
			call: track.commands.reduce<number>((sum, command) => command instanceof CommandCall ? sum + 1 : sum, 0),
			return: track.commands.reduce<number>((sum, command) => command instanceof CommandReturn ? sum + 1 : sum, 0),
			nop: track.commands.reduce<number>((sum, command) => command instanceof CommandNop ? sum + 1 : sum, 0),
		};
	}

	toString() {
		const lines: string[] = [];
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
