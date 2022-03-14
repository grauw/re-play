import fs from "fs";
import { Format } from "./Format.js";
import { CommandLabel, CommandJump, CommandCall, CommandReturn, CommandWait } from "./Command.js";
import { CommandOPL4Register, CommandOPL4WaitLoad } from "./CommandOPL4.js";
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
		const data = new BankedData(this.bankSize, [0xC1, 0, 0, 0]);
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
				blockBank = command.address >> 8;
				blockCommands.push(command);
			} else if (command instanceof CommandOPL4WaitLoad) {
				data.add(0xC0);
			} else if (command instanceof CommandLabel) {
				data.addSymbol(command.name);
			} else if (command instanceof CommandJump) {
				data.add(0xC1, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandCall) {
				data.add(0xC2, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandReturn) {
				data.add(0xC3);
			} else if (command instanceof CommandWait) {
				let ticks = command.ticks;
				while (ticks >= 1) {
					const waitTicks = Math.min(Math.floor(ticks), 0xFF - 0xC3);
					data.add(0xC3 + waitTicks);
					ticks -= waitTicks;
				}
			}
		}

		return data.getData();
	}
}
