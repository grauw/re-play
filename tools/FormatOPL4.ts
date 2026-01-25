import fs from "fs";
import { BankedData } from "./BankedData.ts";
import { Command, CommandCall, CommandJump, CommandLabel, CommandReturn, CommandWait } from "./Command.ts";
import { CommandOPL4Register, CommandOPL4WaitLoad, CommandOPL4WaveMemory } from "./CommandOPL4.ts";
import { FormatReplay, FormatStats, type TransformOptions } from "./Format.ts";
import type { Track } from "./Track.ts";
import { Transform, TransformGroup } from "./Transform.ts";
import { TransformMultiPCMReduceChannels, TransformMultiPCMToOPL4 } from "./TransformMultiPCM.ts";
import { TransformMinimumKeyWait, TransformOPL4AttenuateVolume, TransformOPL4EGToWaveTables, TransformOPL4FrameSanitizer, TransformOPL4MapChannels, TransformOPL4Strip, type StripMode, type StripTarget, type WaveTableOptimizeMode } from "./TransformOPL4.ts";

export type TransformOPL4Options = {
	reduceChannels?: number;
	waveTableOptimization?: WaveTableOptimizeMode;
	waveTablePool?: string;
	channelMapping?: number[];
	fmChannelMapping?: number[];
	waveAttenuation?: number;
	fmAttenuation?: number;
	attenuation?: number;
	initKeyOff?: boolean;
	strip?: StripTarget[];
	stripMode?: StripMode;
	stripPadding?: number;
	stripMargin?: number;
	keyWaitLookback?: number;
};

export const FORMAT_OPL4_ID = 0x01;

export class FormatOPL4 extends FormatReplay {
	private readonly bankSize: number;
	public readonly opl4Frequency: number;

	constructor(bankSize = Infinity, opl4Frequency = 33868800) {
		super();
		this.bankSize = bankSize;
		this.opl4Frequency = opl4Frequency;
	}

	getTransform(options: TransformOPL4Options & TransformOptions) {
		return super.getTransform(options, new TransformGroup([
			new TransformMultiPCMReduceChannels(options.reduceChannels),
			new TransformMultiPCMToOPL4(),
			options.stripMode != "all" ? TransformOPL4EGToWaveTables.create(options.waveTableOptimization, options.waveTablePool) : new Transform(),
			new TransformOPL4MapChannels(options.channelMapping, options.fmChannelMapping),
			new TransformOPL4AttenuateVolume(options.waveAttenuation ?? options.attenuation, options.fmAttenuation ?? options.attenuation),
			new TransformOPL4FrameSanitizer(options.initKeyOff),
			new TransformOPL4Strip(options.strip, options.stripMode, options.stripPadding, options.stripMargin),
			new TransformMinimumKeyWait(options.keyWaitLookback),
		]));
	}

	async saveTrack(track: Track, path: string) {
		const data = this.writeTrack(track);
		await fs.promises.writeFile(path, Buffer.from(data));
	}

	writeTrack(track: Track) {
		const data = new BankedData(this.bankSize, [0xC2, 0, 0, 0]);
		data.add(FORMAT_OPL4_ID);
		let blockBank = -1;
		let blockCommands: CommandOPL4Register[] = [];
		for (const command of track.commands) {
			if (!(command instanceof CommandOPL4Register && command.bank == blockBank)) {
				while (blockCommands.length) {
					const space = Math.floor((data.free - data.jump.length - 1) / 2);
					const count = Math.min(blockCommands.length, 0x40, space > 0 ? space : Infinity);
					data.add([0x00, 0x40, 0x80][blockBank] + count - 1,
						...blockCommands.splice(0, count).flatMap(c => [c.address & 0xFF, c.value]));
				}
			}

			if (command instanceof CommandOPL4Register) {
				if (command.address != 0x105 && command.address != 0x202) {
					blockBank = command.bank;
					blockCommands.push(command);
				}
			} else if (command instanceof CommandOPL4WaitLoad) {
				data.add(0xC3);
			} else if (command instanceof CommandOPL4WaveMemory) {
				data.add(0x83, 0x02, 0x11, 0x03, command.address >> 16 & 0x3F,
					0x04, command.address >> 8 & 0xFF, 0x05, command.address & 0xFF);
				let index = 0;
				while (index < command.memory.length) {
					const space = Math.floor(data.free - data.jump.length - 6);
					const count = Math.min(command.memory.length - index, data.bankSize - data.jump.length - 6, space > 0 ? space : Infinity);
					data.addArray([0xC4, count & 0xFF, count >> 8 & 0xFF, ...command.memory.subarray(index, index + count)]);
					index += count;
				}
				data.add(0x80, 0x02, 0x10);
			} else if (command instanceof CommandLabel) {
				data.addSymbol(command.name);
			} else if (command instanceof CommandCall) {
				data.add(0xC0, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandReturn) {
				data.add(0xC1);
			} else if (command instanceof CommandJump) {
				data.add(0xC2, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandWait) {
				let ticks = command.ticks;
				while (ticks >= 1) {
					const waitTicks = Math.min(Math.floor(ticks), 0xFF - 0xC4);
					data.add(0xC4 + waitTicks);
					ticks -= waitTicks;
				}
			}
		}

		return data.getData();
	}

	getSize(command: Command, preceding?: Command) {
		if (command instanceof CommandOPL4Register) {
			return preceding instanceof CommandOPL4Register && preceding.bank == command.bank ? 2 : 3;
		} else if (command instanceof CommandOPL4WaitLoad) {
			return 1;
		} else if (command instanceof CommandOPL4WaveMemory) {
			return 15 + command.memory.length;
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
		if (command instanceof CommandOPL4Register) {
			if (preceding instanceof CommandOPL4Register && preceding.bank == command.bank) {
				return 46;
			} else {
				return [201, 212, 196][command.bank];
			}
		} else if (command instanceof CommandCall) {
			return 272;
		} else if (command instanceof CommandReturn) {
			return 207;
		} else if (command instanceof CommandJump) {
			return 198;
		} else if (command instanceof CommandOPL4WaitLoad) {
			return 138;
		} else if (command instanceof CommandOPL4WaveMemory) {
			return 0;
		} else if (command instanceof CommandWait) {
			return preceding instanceof CommandWait ? 0 : 131;
		} else {
			return super.getCycles(command, preceding);
		}
	}

	getStats(track: Track) {
		return new FormatOPL4Stats(track, this);
	}
}

class FormatOPL4Stats extends FormatStats {
	private registerCounts: {
		total: number;
		waveTable: number;
		frequencyLow: number;
		frequencyHigh: number;
		level: number;
		key: number;
		lfoVIB: number;
		adsrARD1R: number;
		adsrDLD2R: number;
		adsrRCRR: number;
		lfoAM: number;
	};

	constructor(track: Track, format: FormatOPL4) {
		super(track, format);

		const counts = Array<number>(0x300).fill(0);
		for (const command of track.commands) {
			if (command instanceof CommandOPL4Register) {
				counts[command.address]++;
			}
		}
		this.registerCounts = {
			total: counts.reduce((sum, value) => sum + value, 0),
			waveTable: counts.slice(0x208, 0x220).reduce((sum, value) => sum + value, 0),
			frequencyLow: counts.slice(0x220, 0x238).reduce((sum, value) => sum + value, 0),
			frequencyHigh: counts.slice(0x238, 0x250).reduce((sum, value) => sum + value, 0),
			level: counts.slice(0x250, 0x268).reduce((sum, value) => sum + value, 0),
			key: counts.slice(0x268, 0x280).reduce((sum, value) => sum + value, 0),
			lfoVIB: counts.slice(0x280, 0x298).reduce((sum, value) => sum + value, 0),
			adsrARD1R: counts.slice(0x298, 0x2B0).reduce((sum, value) => sum + value, 0),
			adsrDLD2R: counts.slice(0x2B0, 0x2C8).reduce((sum, value) => sum + value, 0),
			adsrRCRR: counts.slice(0x2C8, 0x2E0).reduce((sum, value) => sum + value, 0),
			lfoAM: counts.slice(0x2E0, 0x2F8).reduce((sum, value) => sum + value, 0),
		};
	}

	toString() {
		const lines = [super.toString()];
		lines.push(`  Total OPL4 register writes: ${this.registerCounts.total}`);
		lines.push(`    Wave Table: ${this.registerCounts.waveTable}`);
		lines.push(`    Frequency Low: ${this.registerCounts.frequencyLow}`);
		lines.push(`    Frequency High: ${this.registerCounts.frequencyHigh}`);
		lines.push(`    Level: ${this.registerCounts.level}`);
		lines.push(`    Key: ${this.registerCounts.key}`);
		lines.push(`    LFO VIB: ${this.registerCounts.lfoVIB}`);
		lines.push(`    ADSR AR D1R: ${this.registerCounts.adsrARD1R}`);
		lines.push(`    ADSR DL D2R: ${this.registerCounts.adsrDLD2R}`);
		lines.push(`    ADSR RC RR: ${this.registerCounts.adsrRCRR}`);
		lines.push(`    LFO AM: ${this.registerCounts.lfoAM}`);
		return lines.join("\n");
	}
}
