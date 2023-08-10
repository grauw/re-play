import fs from "fs";
import { Format, FormatStats } from "./Format.js";
import { CommandLabel, CommandJump, CommandCall, CommandReturn, CommandWait } from "./Command.js";
import { CommandOPLLRegister } from "./CommandOPLL.js";
import { CommandPSGRegister } from "./CommandPSG.js";
import { BankedData } from "./BankedData.js";

export const FORMAT_OPLLPSG_ID = 0x02;

export class FormatOPLLPSG extends Format {
	constructor(bankSize, opllFrequency = 3579545, psgFrequency = 1789773) {
		super();
		this.bankSize = bankSize;
		this.opllFrequency = opllFrequency;
		this.psgFrequency = psgFrequency;
	}

	async saveTrack(track, path) {
		const data = this.writeTrack(track);
		await fs.promises.writeFile(path, Buffer.from(data));
	}

	writeTrack(track) {
		const data = new BankedData(this.bankSize, [0x80, 0, 0, 0]);
		data.add(FORMAT_OPLLPSG_ID);
		let blockBank = -1;
		let blockCommands = [];
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
			} else if (command instanceof CommandJump) {
				data.add(0x80, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandCall) {
				data.add(0x81, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandReturn) {
				data.add(0x82);
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

	getStats(track) {
		return new FormatOPLLPSGStats(track);
	}
}

class FormatOPLLPSGStats extends FormatStats {
	constructor(track) {
		super(track);
		this.registerCounts = FormatOPLLPSGStats.getRegisterCounts(track);
	}

	static getRegisterCounts(track) {
		const opllCounts = Array(0x40).fill(0);
		const psgCounts = Array(0x10).fill(0);
		for (const command of track.commands) {
			if (command instanceof CommandOPLLRegister) {
				opllCounts[command.address]++;
			} else if (command instanceof CommandPSGRegister) {
				psgCounts[command.address]++;
			}
		}
		return {
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
