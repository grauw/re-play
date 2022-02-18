import fs from "fs";
import { Format } from "./Format.js";
import { CommandLabel, CommandJump, CommandCall, CommandReturn, CommandWait } from "./Command.js";
import { CommandFMKey, CommandFMFrequency, CommandFMInstrument } from "./CommandFM.js";

const FORMAT_OPN = 0x00;

export class FormatOPN extends Format {
	constructor(bankSize = 0x2000, tickFrequency = 315000000 / 5256768, opnFrequency = 8000000, opmFrequency = 315000000 / 88) {
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
		const push = (...values) => {
			const free = this.bankSize - (data.length % this.bankSize);
			if (free - values.length < 3)
				data.push(0x90, free - 3, 0, ...Array(free - 3).fill(0));
			data.push(...values);
		};

		let ticks = 0;
		const symbols = new Map();
		const rewrites = [];
		const data = [FORMAT_OPN];
		for (const command of track.commands) {
			if (command instanceof CommandFMKey) {
				push(0x00 | command.slots << 3 | command.channel);
			} else if (command instanceof CommandFMFrequency) {
				const keyCodeFraction = command.getKeyCodeFraction(this.opmFrequency);
				const fNumBlock = command.getFNumBlock(this.opnFrequency / 6);
				push(0x80 + command.channel, ...word(keyCodeFraction), fNumBlock >> 8, fNumBlock & 0xFF);
			} else if (command instanceof CommandFMInstrument) {
				push(0x88 + command.channel, ...command.parameters);
			} else if (command instanceof CommandWait) {
				ticks += command.getTime(this.tickFrequency);
				while (ticks >= 1) {
					const waitTicks = Math.min(Math.floor(ticks), 0xFF - 0x92);
					push(0x92 + waitTicks);
					ticks -= waitTicks;
				}
			} else if (command instanceof CommandLabel) {
				symbols.set(command.name, data.length);
			} else if (command instanceof CommandJump) {
				rewrites.push({ target: command.target, position: data.length + 1 });
				push(0x90, 0, 0);
			} else if (command instanceof CommandCall) {
				rewrites.push({ target: command.target, position: data.length + 1 });
				push(0x91, 0, 0);
			} else if (command instanceof CommandReturn) {
				push(0x92);
			}
		}
		for (const rewrite of rewrites) {
			const offset = symbols.get(rewrite.target) - (rewrite.position + 2);
			data[rewrite.position + 0] = (offset >>  0) & 0xFF;
			data[rewrite.position + 1] = (offset >>  8) & 0xFF;
		}
		return data;
	}
}
