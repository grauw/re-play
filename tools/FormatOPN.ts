import fs from "fs";
import { BankedData } from "./BankedData.ts";
import { Command, CommandCall, CommandJump, CommandLabel, CommandReturn, CommandWait } from "./Command.ts";
import { CommandFMChannel, CommandFMFrequency, CommandFMInstrument, CommandFMKey } from "./CommandFM.ts";
import { FormatReplay, FormatStats, type TransformOptions } from "./Format.ts";
import type { Track } from "./Track.ts";
import { TransformGroup } from "./Transform.ts";
import { TransformOPNAttenuateVolume, TransformOPNFrequencyBeforeKeyOn, TransformOPNMapChannels, TransformOPNToGenericFM } from "./TransformOPN.ts";

export type TransformOPNOptions = {
	channelMapping?: number[];
	attenuation?: number;
};

const FORMAT_OPN_ID = 0x00;

export class FormatOPN extends FormatReplay {
	private readonly bankSize: number;
	public readonly opnFrequency: number;
	public readonly opmFrequency: number;

	constructor(bankSize = Infinity, opnFrequency = 8000000, opmFrequency = 315000000 / 88) {
		super();
		this.bankSize = bankSize;
		this.opnFrequency = opnFrequency;
		this.opmFrequency = opmFrequency;
	}

	getTransform(options: TransformOPNOptions & TransformOptions) {
		return super.getTransform(options, new TransformGroup([
			new TransformOPNToGenericFM(),
			new TransformOPNFrequencyBeforeKeyOn(),
			new TransformOPNMapChannels(options.channelMapping),
			new TransformOPNAttenuateVolume(options.attenuation)
		]));
	}

	async saveTrack(track: Track, path: string) {
		const data = this.writeTrack(track);
		await fs.promises.writeFile(path, Buffer.from(data));
	}

	writeTrack(track: Track) {
		const word = (value: number) => [value & 0xFF, (value >> 8) & 0xFF];

		const data = new BankedData(this.bankSize, [0x92, 0, 0, 0]);
		data.add(FORMAT_OPN_ID);
		for (const command of track.commands) {
			if (command instanceof CommandFMKey) {
				data.add(0x00 | command.slots << 3 | command.channel);
			} else if (command instanceof CommandFMFrequency) {
				const keyCodeFraction = command.getKeyCodeFraction(this.opmFrequency);
				const fNumBlock = command.getFNumBlock(this.opnFrequency / 6);
				data.add(0x80 + command.channel, ...word(keyCodeFraction), fNumBlock >> 8, fNumBlock & 0xFF);
			} else if (command instanceof CommandFMInstrument) {
				data.add(0x88 + command.channel, ...command.parameters);
			} else if (command instanceof CommandLabel) {
				data.addSymbol(command.name);
			} else if (command instanceof CommandCall) {
				data.add(0x90, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandReturn) {
				data.add(0x91);
			} else if (command instanceof CommandJump) {
				data.add(0x92, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandWait) {
				let ticks = command.ticks;
				while (ticks >= 1) {
					const waitTicks = Math.min(Math.floor(ticks), 0xFF - 0x92);
					data.add(0x92 + waitTicks);
					ticks -= waitTicks;
				}
			}
		}
		return data.getData();
	}

	getSize(command: Command, preceding: Command) {
		if (command instanceof CommandFMKey) {
			return 1;
		} else if (command instanceof CommandFMFrequency) {
			return 5;
		} else if (command instanceof CommandFMInstrument) {
			return 26;
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

	getStats(track: Track) {
		return new FormatOPNStats(track, this);
	}
}

class FormatOPNStats extends FormatStats {
	private unusedChannels: number[];

	constructor(track: Track, format: FormatOPN) {
		super(track, format);

		const usedChannels = new Array<boolean>(8).fill(false);
		const keyOnChannels = new Array<boolean>(8).fill(false);
		for (const command of track.commands) {
			if (command instanceof CommandFMChannel) {
				usedChannels[command.channel] = true;
				if (command instanceof CommandFMKey && command.slots) {
					keyOnChannels[command.channel] = true;
				}
			}
		}
		this.unusedChannels = [];
		for (let i = 0; i < 8; ++i) {
			if (usedChannels[i] && !keyOnChannels[i]) {
				this.unusedChannels.push(i);
			}
		}
	}

	toString() {
		const lines = [super.toString()];
		if (this.unusedChannels.length > 0) {
			lines.push(`  Unused channels: ${this.unusedChannels.join(", ")}`);
		}
		return lines.join("\n");
	}
}
