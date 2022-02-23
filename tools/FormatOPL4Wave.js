import fs from "fs";
import { Format } from "./Format.js";
import { CommandLabel, CommandJump, CommandCall, CommandReturn, CommandWait } from "./Command.js";
import { CommandOPL4Wave, CommandOPL4WaitLoad } from "./CommandOPL4.js";
import { BankedData } from "./BankedData.js";

export const FORMAT_OPL4_WAVE_ID = 0x01;

export class FormatOPL4Wave extends Format {
	constructor(bankSize, tickFrequency = 315000000 / 5256768, opl4Frequency = 33868800) {
		super();
		this.bankSize = bankSize;
		this.tickFrequency = tickFrequency;
		this.opl4Frequency = opl4Frequency;
	}

	async saveTrack(track, path) {
		const data = this.writeTrack(track);
		await fs.promises.writeFile(path, Buffer.from(data));
	}

	writeTrack(track) {
		let ticks = 0;
		const data = new BankedData(this.bankSize, [0xFB, 0, 0, 0]);
		data.add(FORMAT_OPL4_WAVE_ID);
		for (const command of track.commands) {
			if (command instanceof CommandOPL4Wave) {
				data.add(command.register, command.value);
			} else if (command instanceof CommandWait) {
				ticks += command.getTime(this.tickFrequency);
				while (ticks >= 1) {
					const waitTicks = Math.min(Math.floor(ticks), 7);
					data.add(0x00 + waitTicks);
					ticks -= waitTicks;
				}
			} else if (command instanceof CommandOPL4WaitLoad) {
				data.add(0xFA);
			} else if (command instanceof CommandLabel) {
				data.addSymbol(command.name);
			} else if (command instanceof CommandJump) {
				data.add(0xFB, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandCall) {
				data.add(0xFC, 0, 0, 0);
				data.addRewrite(command.target);
			} else if (command instanceof CommandReturn) {
				data.add(0xFD);
			}
		}

		return data.getData();
	}
}
