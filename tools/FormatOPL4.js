import fs from "fs";
import { Format, FormatStats } from "./Format.js";
import { CommandLabel, CommandJump, CommandCall, CommandReturn, CommandWait } from "./Command.js";
import { CommandOPL4Register, CommandOPL4WaitLoad, CommandOPL4WaveMemory } from "./CommandOPL4.js";
import { BankedData } from "./BankedData.js";

export const FORMAT_OPL4_ID = 0x01;

export class FormatOPL4 extends Format {
	constructor(bankSize, opl4Frequency = 33868800) {
		super();
		this.bankSize = bankSize;
		this.opl4Frequency = opl4Frequency;
	}

	async saveTrack(track, path) {
		const data = this.writeTrack(track);
		await fs.promises.writeFile(path, Buffer.from(data));
	}

	writeTrack(track) {
		const data = new BankedData(this.bankSize, [0xC2, 0, 0, 0]);
		data.add(FORMAT_OPL4_ID);
		let blockBank = -1;
		let blockCommands = [];
		for (const command of track.commands) {
			if (!(command instanceof CommandOPL4Register && (command.address >> 8) == blockBank)) {
				while (blockCommands.length) {
					const space = Math.floor((data.free - data.jump.length - 1) / 2);
					const count = Math.min(blockCommands.length, 0x40, space > 0 ? space : Infinity);
					data.add([0x00, 0x40, 0x80][blockBank] + count - 1,
						...blockCommands.splice(0, count).flatMap(c => [c.address & 0xFF, c.value]));
				}
			}

			if (command instanceof CommandOPL4Register) {
				if (command.address != 0x105 && command.address != 0x202) {
					blockBank = command.address >> 8;
					blockCommands.push(command);
				}
			} else if (command instanceof CommandOPL4WaitLoad) {
				data.add(0xC0);
			} else if (command instanceof CommandOPL4WaveMemory) {
				let index = 0;
				while (index < command.memory.length) {
					const address = command.address + index;
					const space = Math.floor(data.free - data.jump.length - 6);
					const count = Math.min(command.memory.length - index, data.bankSize - data.jump.length - 6, space > 0 ? space : Infinity);
					data.addArray([0xC1, address & 0xFF, address >> 8 & 0xFF, address >> 16 & 0xFF,
						count & 0xFF, count >> 8 & 0xFF, ...command.memory.subarray(index, index + count)]);
					index += count;
				}
			} else if (command instanceof CommandLabel) {
				data.addSymbol(command.name);
			} else if (command instanceof CommandJump) {
				data.add(0xC2, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandCall) {
				data.add(0xC3, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandReturn) {
				data.add(0xC4);
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

	getStats(track) {
		return new FormatOPL4Stats(track);
	}
}

class FormatOPL4Stats extends FormatStats {
	constructor(track) {
		super(track);
		this.registerCounts = FormatOPL4Stats.getRegisterCounts(track);
	}

	static getRegisterCounts(track) {
		const counts = Array(0x300).fill(0);
		for (const command of track.commands) {
			if (command instanceof CommandOPL4Register) {
				counts[command.address]++;
			}
		}
		return {
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
