import fs from "fs";
import zlib from "zlib";
import util from "util";
import { Format } from "./Format.js";
import { Track } from "./Track.js";
import { CommandLabel, CommandJump, CommandReturn, CommandWait } from "./Command.js";
import { CommandOPNConfig, CommandOPNRegister, CommandFMKey, CommandFMFrequency, CommandFMInstrument } from "./CommandFM.js";
import { CommandOPL4Config, CommandOPL4Register, CommandOPL4WaveMemory } from "./CommandOPL4.js";
import { yrw801Headers } from "./YRW801Headers.js";

export class FormatVGM extends Format {
	async loadTrack(path, name) {
		let vgm = await fs.promises.readFile(path);
		if (vgm[0] == 0x1f && vgm[1] == 0x8b)  // gzip magic number
			vgm = await util.promisify(zlib.gunzip)(vgm);
		return this.readTrack(vgm, name);
	}

	readTrack(vgm, name) {
		const getByte = address => vgm[address];
		const getWord = address => getByte(address) | getByte(address + 1) << 8;
		const getDoubleWord = address => getWord(address) | getWord(address + 2) << 16;
		if (getDoubleWord(0x00) != 0x206d6756)
			throw new Error("Not a VGM file.");
		const version = getDoubleWord(0x08);
		const loop = getDoubleWord(0x1C) ? getDoubleWord(0x1C) + 0x1C : 0;
		const headerSize = version >= 0x150 ? getDoubleWord(0x34) + 0x34 : 0x40;
		const getHeaderWord = address => version >= 0x150 && headerSize >= address + 4 ? getDoubleWord(address) : 0;
		const getChipFrequency = address => getHeaderWord(address) & 0x3FFFFFFF;

		const track = new Track(name, 44100);
		const opl4Memory = new FormatVGMOPL4Memory();

		if (getChipFrequency(0x44)) {
			track.addCommand(CommandOPNConfig.of(getChipFrequency(0x44), "ym2203"));
		} else if (getChipFrequency(0x60)) {
			track.addCommand(CommandOPL4Config.of(getChipFrequency(0x60), "ymf278b"));
		} else if (getChipFrequency(0x5C)) {
			track.addCommand(CommandOPL4Config.of(getChipFrequency(0x5C), "ymf262"));
		} else if (getChipFrequency(0x50)) {
			track.addCommand(CommandOPL4Config.of(getChipFrequency(0x50), "ym3812"));
		} else if (getChipFrequency(0x54)) {
			track.addCommand(CommandOPL4Config.of(getChipFrequency(0x54), "ym3526"));
		} else if (getChipFrequency(0x58)) {
			track.addCommand(CommandOPL4Config.of(getChipFrequency(0x58), "y8950"));
		}

		let address = headerSize;
		while (address < vgm.length) {
			if (address == loop) {
				track.addCommand(CommandLabel.of("loop"));
			}
			const type = getByte(address++);
			if (type == 0x55) {
				const register = getByte(address++);
				const value = getByte(address++);
				track.addCommand(CommandOPNRegister.of(register, value));
			} else if (type == 0xA5) {
				const register = getByte(address++);
				const value = getByte(address++);
				track.addCommand(CommandOPNRegister.of(0x100 | register, value));
			} else if (type == 0x5A) {
				const register = getByte(address++);
				const value = getByte(address++);
				track.addCommand(CommandOPL4Register.of(register, value));
			} else if (type == 0x5B) {
				const register = getByte(address++);
				const value = getByte(address++);
				track.addCommand(CommandOPL4Register.of(register, value));
			} else if (type == 0x5C) {
				const register = getByte(address++);
				const value = getByte(address++);
				track.addCommand(CommandOPL4Register.of(register, value));
			} else if (type == 0x5E) {
				const register = getByte(address++);
				const value = getByte(address++);
				track.addCommand(CommandOPL4Register.of(register, value));
			} else if (type == 0x5F) {
				const register = getByte(address++);
				const value = getByte(address++);
				track.addCommand(CommandOPL4Register.of(0x100 | register, value));
			} else if (type == 0xD0) {
				const port = getByte(address++);
				const register = getByte(address++);
				const value = getByte(address++);
				track.addCommand(CommandOPL4Register.of(port << 8 | register, value));
			} else if (type == 0x61) {
				track.addCommand(CommandWait.of(getWord(address)));
				address += 2;
			} else if (type == 0x62) {
				track.addCommand(CommandWait.of(735));
			} else if (type == 0x63) {
				track.addCommand(CommandWait.of(882));
			} else if (type == 0x66) {
				if (loop) {
					track.addCommand(CommandJump.of("loop"));
				} else {
					track.addCommand(CommandReturn.of());
				}
				break;
			} else if (type == 0x67) {
				if (getByte(address++) != 0x66)
					throw new Error(`Invalid data block sequence at address 0x${(address - 1).toString(16).toUpperCase()}`);
				const dataType = getByte(address++);
				const dataSize = getDoubleWord(address);
				address += 4;
				if (dataType == 0x84) {
					const romSize = getDoubleWord(address);
					const dataStart = getDoubleWord(address + 4);
					opl4Memory.writeROMData(romSize, dataStart, vgm.subarray(address + 8, address + dataSize));
					track.addCommand(CommandOPL4WaveMemory.of(Uint8Array.from(opl4Memory.data)));
				}
				if (dataType == 0x87) {
					const ramSize = getDoubleWord(address);
					const dataStart = getDoubleWord(address + 4);
					opl4Memory.writeRAMData(ramSize, dataStart, vgm.subarray(address + 8, address + dataSize));
					track.addCommand(CommandOPL4WaveMemory.of(Uint8Array.from(opl4Memory.data)));
				}
				address += dataSize;  // skip
			} else if (type >= 0x70 && type < 0x80) {
				track.addCommand(CommandWait.of((type & 15) + 1));
			} else {
				throw new Error(`Unsupported command ${type.toString(16)} at address 0x${(address - 1).toString(16).toUpperCase()}`);
			}
		}
		return track;
	}
}

class FormatVGMOPL4Memory {
	constructor() {
		this.data = new Uint8Array(0x400000);
		this.data.set(yrw801Headers);
		this.romSize = 0x200000;
		this.ramSize = 0x000000;
	}

	writeROMData(romSize, dataStart, data) {
		if (romSize != this.romSize) {
			this.memory.copyWithin(romSize, this.romSize);
		}
		this.memory.set(data, dataStart);
		this.romSize = romSize;
	}

	writeRAMData(ramSize, dataStart, data) {
		this.memory.set(data, this.romSize + dataStart);
		this.ramSize = ramSize;
	}
}

export class FormatVGMOPNB extends Format {
	constructor(opnbFrequency = 8000000) {
		super();
		this.opnbFrequency = opnbFrequency;
	}

	async saveTrack(track, path) {
		const data = this.writeTrack(track);
		await fs.promises.writeFile(path, Buffer.from(data));
	}

	writeTrack(track) {
		let samples = 0;
		let loopOffset = -1;
		let loopSamples = -1;
		const commandData = [];
		for (const command of track.commands) {
			if (command instanceof CommandFMKey) {
				commandData.push(0x58, 0x28, command.slots << 4 | command.channel);
			} else if (command instanceof CommandFMFrequency) {
				const fNumBlock = command.getFNumBlock(this.opnbFrequency / 6);
				commandData.push(0x58 + (command.channel >> 2), 0xA4 + (command.channel & 3), fNumBlock >> 8);
				commandData.push(0x58 + (command.channel >> 2), 0xA0 + (command.channel & 3), fNumBlock & 0xFF);
			} else if (command instanceof CommandFMInstrument) {
				for (let i = 0; i < 24; i++)
					commandData.push(0x58 + (command.channel >> 2), 0x30 + i * 4 + (command.channel & 3), command.parameters[i]);
				commandData.push(0x58 + (command.channel >> 2), 0xB0 + (command.channel & 3), command.parameters[24]);
			} else if (command instanceof CommandWait) {
				let ticks = Math.round(command.ticks * 44100 / track.tickFrequency);
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
		// data.push(...doubleWord(this.opnbFrequency | Math.pow(2, 31)));  // 4C YM2610 / YM2610B clock
		data.push(...doubleWord(this.opnbFrequency));  // 4C YM2610 / YM2610B clock
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
		return data;
	}
}

export class FormatVGMOPM extends Format {
	constructor(opmFrequency = 315000000 / 88) {
		super();
		this.opmFrequency = opmFrequency;
	}

	async saveTrack(track, path) {
		const data = this.writeTrack(track);
		await fs.promises.writeFile(path, Buffer.from(data));
	}

	writeTrack(track) {
		let samples = 0;
		let loopOffset = -1;
		let loopSamples = -1;
		const commandData = [];
		for (const command of track.commands) {
			if (command instanceof CommandFMKey) {
				commandData.push(0x54, 0x08, command.slots << 3 | command.channel);
			} else if (command instanceof CommandFMFrequency) {
				const keyCodeFraction = command.getKeyCodeFraction(this.opmFrequency);
				commandData.push(0x54, 0x30 + command.channel, keyCodeFraction & 0xFF);
				commandData.push(0x54, 0x28 + command.channel, keyCodeFraction >> 8);
			} else if (command instanceof CommandFMInstrument) {
				for (let i = 0; i < 24; i++)
					commandData.push(0x54, 0x40 + i * 8 + command.channel, command.parameters[i]);
				commandData.push(0x54, 0x20 + command.channel, command.parameters[24]);
			} else if (command instanceof CommandWait) {
				let ticks = Math.round(command.ticks * 44100 / track.tickFrequency);
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
		data.push(...doubleWord(this.opmFrequency));  // 30 YM2151 / YM2164 clock
		data.push(...doubleWord(0x40 - 0x34));  // 34 VGM data offset
		data.push(0x00, 0x00, 0x00, 0x00);  // 38 Sega PCM clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 3C Sega PCM interface register
		data.push(...commandData);
		return data;
	}
}
