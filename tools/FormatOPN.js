import fs from "fs";
import { Format, FormatStats } from "./Format.js";
import { CommandLabel, CommandJump, CommandCall, CommandReturn, CommandWait } from "./Command.js";
import { CommandFMChannel, CommandFMKey, CommandFMFrequency, CommandFMInstrument } from "./CommandFM.js";
import { BankedData } from "./BankedData.js";

const FORMAT_OPN_ID = 0x00;

export class FormatOPN extends Format {
	constructor(bankSize, opnFrequency = 8000000, opmFrequency = 315000000 / 88) {
		super();
		this.bankSize = bankSize;
		this.opnFrequency = opnFrequency;
		this.opmFrequency = opmFrequency;
	}

	async saveTrack(track, path) {
		const data = this.writeTrack(track);
		await fs.promises.writeFile(path, Buffer.from(data));
	}

	writeTrack(track) {
		const word = value => [value & 0xFF, (value >> 8) & 0xFF];

		const data = new BankedData(this.bankSize, [0x90, 0, 0, 0]);
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
			} else if (command instanceof CommandJump) {
				data.add(0x90, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandCall) {
				data.add(0x91, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandReturn) {
				data.add(0x92);
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

	getSize(command, preceding) {
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

	getStats(track) {
		return new FormatOPNStats(track, this);
	}
}

class FormatOPNStats extends FormatStats {
	constructor(track, format) {
		super(track, format);
		this.unusedChannels = FormatOPNStats.getUnusedChannels(track);
	}

	static getUnusedChannels(track) {
		const usedChannels = new Array(8).fill(false);
		const keyOnChannels = new Array(8).fill(false);
		for (const command of track.commands) {
			if (command instanceof CommandFMChannel) {
				usedChannels[command.channel] = true;
				if (command instanceof CommandFMKey && command.slots) {
					keyOnChannels[command.channel] = true;
				}
			}
		}
		const unusedChannels = [];
		for (let i = 0; i < 8; ++i) {
			if (usedChannels[i] && !keyOnChannels[i]) {
				unusedChannels.push(i);
			}
		}
		return unusedChannels;
	}

	toString() {
		const lines = [super.toString()];
		if (this.unusedChannels.length > 0) {
			lines.push(`  Unused channels: ${this.unusedChannels.join(", ")}`);
		}
		return lines.join("\n");
	}
}
