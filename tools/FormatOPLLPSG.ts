import fs from "fs";
import { BankedData } from "./BankedData.ts";
import { Command, CommandCall, CommandJump, CommandLabel, CommandReturn, CommandWait } from "./Command.ts";
import { CommandOPLLRegister } from "./CommandOPLL.ts";
import { CommandPSGRegister } from "./CommandPSG.ts";
import { FormatReplay, FormatStats, type TransformOptions, type TransformSetupOptions } from "./Format.ts";
import type { Track } from "./Track.ts";
import { TransformGroup } from "./Transform.ts";
import { TransformOPLLAttenuateVolume, TransformOPLLFrameSanitizer, TransformOPLLMapChannels, TransformOPLLSetup } from "./TransformOPLL.ts";
import { TransformPSGAttenuateVolume, TransformPSGFrameSanitizer, TransformPSGMapChannels, TransformPSGSetup } from "./TransformPSG.ts";

export type TransformOPLLPSGOptions = {
	channelMapping?: number[];
	psgChannelMapping?: number[];
	attenuation?: number;
	opllSetup?: TransformSetupOptions;
	psgSetup?: TransformSetupOptions;
};

export const FORMAT_OPLLPSG_ID = 0x02;

export class FormatOPLLPSG extends FormatReplay {
	private readonly bankSize: number;
	public readonly opllFrequency: number;
	public readonly psgFrequency: number;

	constructor(bankSize = Infinity, opllFrequency = 315000000 / 88, psgFrequency = 315000000 / 88 / 2) {
		super();
		this.bankSize = bankSize;
		this.opllFrequency = opllFrequency;
		this.psgFrequency = psgFrequency;
	}

	getTransform(options: TransformOPLLPSGOptions & TransformOptions) {
		return super.getTransform(options, new TransformGroup([
			new TransformOPLLSetup(options.opllSetup),
			new TransformPSGSetup(options.psgSetup),
		]), new TransformGroup([
			new TransformOPLLMapChannels(options.channelMapping),
			new TransformPSGMapChannels(options.psgChannelMapping),
			new TransformOPLLAttenuateVolume(options.attenuation),
			new TransformPSGAttenuateVolume(options.attenuation),
			new TransformOPLLFrameSanitizer(),
			new TransformPSGFrameSanitizer(),
		]));
	}

	async saveTrack(track: Track, path: string) {
		const data = this.writeTrack(track);
		await fs.promises.writeFile(path, Buffer.from(data));
	}

	writeTrack(track: Track) {
		const data = new BankedData(this.bankSize, [0x82, 0, 0, 0]);
		data.add(FORMAT_OPLLPSG_ID);
		let blockBank = -1;
		let blockCommands: (CommandOPLLRegister | CommandPSGRegister)[] = [];
		for (const command of track.commands) {
			if (!(command instanceof CommandOPLLRegister && blockBank == 0 ||
				command instanceof CommandPSGRegister && blockBank == 1)) {
				while (blockCommands.length) {
					const space = Math.floor((data.free - data.jump.length - 1) / 2);
					const count = Math.min(blockCommands.length, 0x40, space > 0 ? space : Infinity);
					data.add([0x00, 0x40][blockBank] + count - 1,
						...blockCommands.splice(0, count).flatMap(c => [c.address & 0xFF, c.value]));
				}
			}

			if (command instanceof CommandOPLLRegister) {
				blockBank = 0;
				blockCommands.push(command);
			} else if (command instanceof CommandPSGRegister) {
				blockBank = 1;
				blockCommands.push(command);
			} else if (command instanceof CommandLabel) {
				data.addSymbol(command.name);
			} else if (command instanceof CommandCall) {
				data.add(0x80, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandReturn) {
				data.add(0x81);
			} else if (command instanceof CommandJump) {
				data.add(0x82, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandWait) {
				let ticks = command.ticks;
				while (ticks >= 1) {
					const waitTicks = Math.min(Math.floor(ticks), 0xFF - 0x82);
					data.add(0x82 + waitTicks);
					ticks -= waitTicks;
				}
			}
		}

		return data.getData();
	}

	getSize(command: Command, preceding?: Command) {
		if (command instanceof CommandOPLLRegister) {
			return preceding instanceof CommandOPLLRegister ? 2 : 3;
		} else if (command instanceof CommandPSGRegister) {
			return preceding instanceof CommandPSGRegister ? 2 : 3;
		} else if (command instanceof CommandWait) {
			return preceding instanceof CommandWait ? 0 : 1;
		} else if (command instanceof CommandCall || command instanceof CommandJump) {
			return 4;
		} else if (command instanceof CommandReturn) {
			return 1;
		} else {
			return super.getSize(command, preceding);
		}
	}

	getCycles(command: Command, preceding?: Command) {
		if (command instanceof CommandOPLLRegister) {
			return preceding instanceof CommandOPLLRegister ? 126 : 231;
		} else if (command instanceof CommandPSGRegister) {
			return preceding instanceof CommandPSGRegister ? 57 : 172;
		} else if (command instanceof CommandCall) {
			return 253;
		} else if (command instanceof CommandReturn) {
			return 196;
		} else if (command instanceof CommandJump) {
			return 179;
		} else if (command instanceof CommandWait) {
			return preceding instanceof CommandWait ? 0 : 85;
		} else {
			return super.getSize(command, preceding);
		}
	}

	getStats(track: Track) {
		return new FormatOPLLPSGStats(track, this);
	}
}

class FormatOPLLPSGStats extends FormatStats {
	private registerCounts: {
		opll: { total: number; };
		psg: { total: number; };
	};

	constructor(track: Track, format: FormatOPLLPSG) {
		super(track, format);

		const opllCounts = Array<number>(0x40).fill(0);
		const psgCounts = Array<number>(0x10).fill(0);
		for (const command of track.commands) {
			if (command instanceof CommandOPLLRegister) {
				opllCounts[command.address]++;
			} else if (command instanceof CommandPSGRegister) {
				psgCounts[command.address]++;
			}
		}
		this.registerCounts = {
			opll: {
				total: opllCounts.reduce((sum, value) => sum + value, 0),
			},
			psg: {
				total: psgCounts.reduce((sum, value) => sum + value, 0),
			},
		};
	}

	toString() {
		const lines = [super.toString()];
		lines.push(`  Total OPLL register writes: ${this.registerCounts.opll.total}`);
		lines.push(`  Total PSG register writes: ${this.registerCounts.psg.total}`);
		return lines.join("\n");
	}
}
