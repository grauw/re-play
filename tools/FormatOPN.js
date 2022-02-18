import fs from "fs";
import { Format } from "./Format.js";
import { CommandLabel, CommandJump, CommandCall, CommandReturn, CommandWait } from "./Command.js";
import { CommandFMKey, CommandFMFrequency, CommandFMInstrument } from "./CommandFM.js";

export const FORMAT_OPN = 0x00;

export class FormatOPN extends Format {
	async saveTrack(track, tickFrequency, opnFrequency, opmFrequency) {
		const data = this.writeTrack(track, tickFrequency, opnFrequency, opmFrequency);
		await fs.promises.writeFile(this.path, Buffer.from(data));
	}

	writeTrack(track, tickFrequency, opnFrequency, opmFrequency) {
		const word = value => [value & 0xFF, (value >> 8) & 0xFF];
		let ticks = 0;
		const symbols = new Map();
		const rewrites = [];
		const data = [FORMAT_OPN];
		for (const command of track.commands) {
			if (command instanceof CommandFMKey) {
				data.push(0x00 | command.slots << 3 | command.channel);
			} else if (command instanceof CommandFMFrequency) {
				const keyCodeFraction = command.getKeyCodeFraction(opmFrequency);
				const fNumBlock = command.getFNumBlock(opnFrequency / 6);
				data.push(0x80 + command.channel, ...word(keyCodeFraction), fNumBlock >> 8, fNumBlock & 0xFF);
			} else if (command instanceof CommandFMInstrument) {
				data.push(0x88 + command.channel, ...command.parameters);
			} else if (command instanceof CommandWait) {
				ticks += command.getTime(tickFrequency);
				while (ticks >= 1) {
					const waitTicks = Math.min(Math.floor(ticks), 0xFF - 0x92);
					data.push(0x92 + waitTicks);
					ticks -= waitTicks;
				}
			} else if (command instanceof CommandLabel) {
				symbols.set(command.name, data.length);
			} else if (command instanceof CommandJump) {
				rewrites.push({ target: command.target, position: data.length + 1 });
				data.push(0x90, 0, 0);
			} else if (command instanceof CommandCall) {
				rewrites.push({ target: command.target, position: data.length + 1 });
				data.push(0x91, 0, 0);
			} else if (command instanceof CommandReturn) {
				data.push(0x92);
			}
		}
		for (const rewrite of rewrites) {
			const offset = word(symbols.get(rewrite.target) - rewrite.position - 2);
			data[rewrite.position] = offset[0];
			data[rewrite.position + 1] = offset[1];
		}
		return data;
	}
}
