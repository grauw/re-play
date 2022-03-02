import fs from "fs";
import { Format } from "./Format.js";
import { CommandLabel, CommandJump, CommandCall, CommandReturn, CommandWait } from "./Command.js";
import { CommandOPL4Register, CommandOPL4WaitLoad } from "./CommandOPL4.js";
import { BankedData } from "./BankedData.js";

export const FORMAT_OPL4_WAVE_ID = 0x01;

export class FormatOPL4Wave extends Format {
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
		const data = new BankedData(this.bankSize, [0x01, 0, 0, 0]);
		data.add(FORMAT_OPL4_WAVE_ID);
		const registerBlock = [];
		for (const command of track.commands) {
			if (command instanceof CommandOPL4Register && command.address >= 0x200) {
				registerBlock.push(command);
				continue;
			} else {
				while (registerBlock.length) {
					const space = Math.floor((data.free - data.jump.length - 1) / 2);
					const count = Math.min(registerBlock.length, 0x80, space > 0 ? space : Infinity);
					data.add(0x80 | count, ...registerBlock.splice(0, count).flatMap(c => [c.address, c.value]));
				}
			}

			if (command instanceof CommandOPL4WaitLoad) {
				data.add(0x00);
			} else if (command instanceof CommandLabel) {
				data.addSymbol(command.name);
			} else if (command instanceof CommandJump) {
				data.add(0x01, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandCall) {
				data.add(0x02, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandReturn) {
				data.add(0x03);
			} else if (command instanceof CommandWait) {
				let ticks = command.ticks;
				while (ticks >= 1) {
					const waitTicks = Math.min(Math.floor(ticks), 0x7F - 0x03);
					data.add(0x03 + waitTicks);
					ticks -= waitTicks;
				}
			}
		}

		return data.getData();
	}
}
