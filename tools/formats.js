import fs from "fs";
import { checkTypes } from "./utils.js";
import { Track, CommandLabel, CommandJump, CommandCall, CommandReturn, CommandWait,
	CommandOPNB, CommandFMKey, CommandFMFrequency, CommandFMInstrument } from "./audio.js";

export class AudioFile {
	constructor(name, path) {
		checkTypes(arguments, "string", "string");
		this.name = name;
		this.path = path;
	}
}

export class VGMFile extends AudioFile {
	async loadTrack() {
		const vgm = await fs.promises.readFile(this.path);
		const getByte = address => vgm[address];
		const getWord = address => getByte(address) | getByte(address + 1) << 8;
		const getDoubleWord = address => getWord(address) | getWord(address + 2) << 16;
		if (getDoubleWord(0x00) != 0x206d6756)
			throw new Error("Not a VGM file.");
		const version = getDoubleWord(0x08);
		const loop = getDoubleWord(0x1C) ? getDoubleWord(0x1C) + 0x1C : 0;
		const headerSize = version >= 0x150 ? getDoubleWord(0x34) + 0x34 : 0x40;
		const opnFrequency = version >= 0x150 && headerSize >= 0x48 ? getDoubleWord(0x44) & 0x3FFFFFFF : 0;
		const tickFrequency = 44100;
		const track = new Track(this.name);
		let address = headerSize;
		while (address < vgm.length) {
			if (address == loop)
				track.addCommand(CommandLabel.of("loop"));
			const type = getByte(address++);
			if (type == 0x55) {
				const register = getByte(address++);
				const value = getByte(address++);
				track.addCommand(CommandOPNB.of(register, value, opnFrequency * 2));
			} else if (type == 0xA5) {
				const register = getByte(address++);
				const value = getByte(address++);
				if (register == 0x28) {
					track.addCommand(CommandOPNB.of(register, value | 4, opnFrequency * 2));
				} else if (register >= 0x30) {
					track.addCommand(CommandOPNB.of(register | 0x100, value, opnFrequency * 2));
				}
			} else if (type == 0x61) {
				track.addCommand(CommandWait.of(getWord(address), tickFrequency));
				address += 2;
			} else if (type == 0x62) {
				track.addCommand(CommandWait.of(735, tickFrequency));
			} else if (type == 0x63) {
				track.addCommand(CommandWait.of(882, tickFrequency));
			} else if (type == 0x66) {
				if (loop) {
					track.addCommand(CommandJump.of("loop"));
				} else {
					track.addCommand(CommandReturn.of());
				}
				break;
			} else if (type >= 0x70 && type < 0x80) {
				track.addCommand(CommandWait.of((type & 15) + 1, tickFrequency));
			} else {
				throw new Error(`Unsupported command ${type.toString(16)} at address ${(address - 1).toString(16)}`);
			}
		}
		return track;
	}

	async saveTrackOPNB(track, opnbFrequency) {
		checkTypes(arguments, Track, "number");
		let samples = 0;
		let loopOffset = -1;
		let loopSamples = -1;
		const commandData = [];
		for (const command of track.commands) {
			if (command instanceof CommandOPNB) {
				commandData.push(0x58 | command.address >> 8, command.address & 0xFF, command.value);
			} else if (command instanceof CommandFMKey) {
				commandData.push(0x58, 0x28, command.slots << 4 | command.channel);
			} else if (command instanceof CommandFMFrequency) {
				const fNumBlock = command.getFNumBlock(opnbFrequency / 6);
				commandData.push(0x58 + (command.channel >> 2), 0xA4 + (command.channel & 3), fNumBlock >> 8);
				commandData.push(0x58 + (command.channel >> 2), 0xA0 + (command.channel & 3), fNumBlock & 0xFF);
			} else if (command instanceof CommandFMInstrument) {
				for (let i = 0; i < 24; i++)
					commandData.push(0x58 + (command.channel >> 2), 0x30 + i * 4 + (command.channel & 3), command.parameters[i]);
				commandData.push(0x58 + (command.channel >> 2), 0xB0 + (command.channel & 3), command.parameters[24]);
			} else if (command instanceof CommandWait) {
				let ticks = Math.round(command.getTime(44100));
				samples += ticks;
				while (ticks > 0) {
					const ticksCapped = Math.min(ticks, 65535);
					commandData.push(0x61, ticksCapped & 0xFF, ticksCapped >> 8);
					ticks -= ticksCapped;
				}
			} else if (command instanceof CommandLabel && command.name == "loop") {
				loopOffset = commandData.length;
				loopSamples = samples;
			}
		}
		commandData.push(0x66);

		const data = [];
		const doubleWord = value => [value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF, (value >> 24) & 0xFF];
		data.push(0x56, 0x67, 0x6d, 0x20);  // 00 VGM ID
		data.push(...doubleWord(0x80 + commandData.length - 0x04));  // 04 EOF offset
		data.push(...doubleWord(0x151));  // 08 version number
		data.push(0x00, 0x00, 0x00, 0x00);  // 0C SN76489 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 10 YM2413 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 14 GD3 offset
		data.push(...doubleWord(samples));  // 18 Total # samples
		data.push(...doubleWord(loopOffset >= 0 ? 0x80 + loopOffset - 0x1C : 0));  // 1C Loop offset
		data.push(...doubleWord(loopSamples >= 0 ? samples - loopSamples : 0));  // 20 Loop # samples
		data.push(0x00, 0x00, 0x00, 0x00);  // 24 Rate
		data.push(0x00, 0x00, 0x00, 0x00);  // 28 SN76489 flags
		data.push(0x00, 0x00, 0x00, 0x00);  // 2C YM2612 / YM3438 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 30 YM2151 / YM2164 clock
		data.push(...doubleWord(0x80 - 0x34));  // 34 VGM data offset
		data.push(0x00, 0x00, 0x00, 0x00);  // 38 Sega PCM clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 3C Sega PCM interface register
		data.push(0x00, 0x00, 0x00, 0x00);  // 40 RF5C68 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 44 YM2203 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 48 YM2608 clock
		// data.push(...doubleWord(opnbFrequency | Math.pow(2, 31)));  // 4C YM2610 / YM2610B clock
		data.push(...doubleWord(opnbFrequency));  // 4C YM2610 / YM2610B clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 50 YM3812 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 54 YM3526 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 58 Y8950 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 5C YMF262 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 60 YMF278B clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 64 YMF271 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 68 YMZ280B clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 6C RF5C164 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 70 PWM clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 74 AY8910 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 78 YM2203 / YM2608/AY8910 flags
		data.push(0x00, 0x00, 0x00, 0x00);  // 7C Volume / loop modifiers
		data.push(...commandData);

		await fs.promises.writeFile(this.path, Buffer.from(data));
	}

	async saveTrackOPM(track, opmFrequency) {
		checkTypes(arguments, Track, "number");
		let samples = 0;
		let loopOffset = -1;
		let loopSamples = -1;
		const commandData = [];
		for (const command of track.commands) {
			if (command instanceof CommandOPNB) {
				throw new Error("Use toFMCommands() first.");
			} else if (command instanceof CommandFMKey) {
				commandData.push(0x54, 0x08, command.slots << 3 | command.channel);
			} else if (command instanceof CommandFMFrequency) {
				const keyCodeFraction = command.getKeyCodeFraction(opmFrequency);
				commandData.push(0x54, 0x30 + command.channel, keyCodeFraction & 0xFF);
				commandData.push(0x54, 0x28 + command.channel, keyCodeFraction >> 8);
			} else if (command instanceof CommandFMInstrument) {
				for (let i = 0; i < 24; i++)
					commandData.push(0x54, 0x40 + i * 8 + command.channel, command.parameters[i]);
				commandData.push(0x54, 0x20 + command.channel, command.parameters[24]);
			} else if (command instanceof CommandWait) {
				let ticks = Math.round(command.getTime(44100));
				samples += ticks;
				while (ticks > 0) {
					const ticksCapped = Math.min(ticks, 65535);
					commandData.push(0x61, ticksCapped & 0xFF, ticksCapped >> 8);
					ticks -= ticksCapped;
				}
			} else if (command instanceof CommandLabel && command.name == "loop") {
				loopOffset = commandData.length;
				loopSamples = samples;
			}
		}
		commandData.push(0x66);

		const data = [];
		const doubleWord = value => [value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF, (value >> 24) & 0xFF];
		data.push(0x56, 0x67, 0x6d, 0x20);  // 00 VGM ID
		data.push(...doubleWord(0x40 + commandData.length - 0x04));  // 04 EOF offset
		data.push(...doubleWord(0x151));  // 08 version number
		data.push(0x00, 0x00, 0x00, 0x00);  // 0C SN76489 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 10 YM2413 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 14 GD3 offset
		data.push(...doubleWord(samples));  // 18 Total # samples
		data.push(...doubleWord(loopOffset >= 0 ? 0x40 + loopOffset - 0x1C : 0));  // 1C Loop offset
		data.push(...doubleWord(loopSamples >= 0 ? samples - loopSamples : 0));  // 20 Loop # samples
		data.push(0x00, 0x00, 0x00, 0x00);  // 24 Rate
		data.push(0x00, 0x00, 0x00, 0x00);  // 28 SN76489 flags
		data.push(0x00, 0x00, 0x00, 0x00);  // 2C YM2612 / YM3438 clock
		data.push(...doubleWord(opmFrequency));  // 30 YM2151 / YM2164 clock
		data.push(...doubleWord(0x40 - 0x34));  // 34 VGM data offset
		data.push(0x00, 0x00, 0x00, 0x00);  // 38 Sega PCM clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 3C Sega PCM interface register
		data.push(...commandData);

		await fs.promises.writeFile(this.path, Buffer.from(data));
	}
}

export class GNGFile extends AudioFile {
	async saveTrack(track, tickFrequency, opnFrequency, opmFrequency) {
		checkTypes(arguments, Track, "number", "number", "number");
		const word = value => [value & 0xFF, (value >> 8) & 0xFF];
		let ticks = 0;
		const symbols = new Map();
		const rewrites = [];
		const data = [];
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
					const waitTicks = Math.min(Math.floor(ticks), 0x6D);
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

		await fs.promises.writeFile(this.path, Buffer.from(data));
	}
}
