import fs from "fs";
import { Format } from "./Format.js";
import { CommandLabel, CommandJump, CommandCall, CommandReturn, CommandWait } from "./Command.js";
import { CommandFMKey, CommandFMFrequency, CommandFMInstrument } from "./CommandFM.js";
import { BankedData } from "./BankedData.js";

const FORMAT_OPN_ID = 0x00;

export class FormatOPN extends Format {
	constructor(bankSize, tickFrequency = 315000000 / 5256768, opnFrequency = 8000000, opmFrequency = 315000000 / 88) {
		super();
		this.bankSize = bankSize;
		this.tickFrequency = tickFrequency;
		this.opnFrequency = opnFrequency;
		this.opmFrequency = opmFrequency;
	}

	async saveTrack(track, path) {
		const data = this.writeTrack(track);
		await fs.promises.writeFile(path, Buffer.from(data));
	}

	writeTrack(track) {
		const word = value => [value & 0xFF, (value >> 8) & 0xFF];

		let ticks = 0;
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
				ticks += command.getTime(this.tickFrequency);
				while (ticks >= 1) {
					const waitTicks = Math.min(Math.floor(ticks), 0xFF - 0x92);
					data.add(0x92 + waitTicks);
					ticks -= waitTicks;
				}
			}
		}
		return data.getData();
	}
}
