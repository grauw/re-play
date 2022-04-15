import fs from "fs";
import zlib from "zlib";
import util from "util";
import { Format } from "./Format.js";
import { Track } from "./Track.js";
import { CommandLabel, CommandJump, CommandReturn, CommandWait, CommandGD3 } from "./Command.js";
import { CommandOPNConfig, CommandOPNRegister, CommandFMKey, CommandFMFrequency, CommandFMInstrument } from "./CommandFM.js";
import { CommandOPL4Config, CommandOPL4Register, CommandOPL4WaveMemory } from "./CommandOPL4.js";

const VGM_MAGIC_NUMBER = 0x206d6756;
const GD3_MAGIC_NUMBER = 0x20336447;

export class FormatVGM extends Format {
	constructor() {
		super(false);
	}

	async loadTrack(path, name) {
		let vgm = await fs.promises.readFile(path);
		if (vgm[0] == 0x1f && vgm[1] == 0x8b)  // gzip magic number
			vgm = await util.promisify(zlib.gunzip)(vgm);
		return this.readTrack(new VGMData(vgm), name);
	}

	readTrack(vgm, name) {
		if (vgm.getDoubleWord(0x00) != VGM_MAGIC_NUMBER)
			throw new Error("Not a VGM file.");
		const version = vgm.getDoubleWord(0x08);
		const loop = vgm.getDoubleWord(0x1C) ? vgm.getDoubleWord(0x1C) + 0x1C : 0;
		const headerSize = version >= 0x150 ? vgm.getDoubleWord(0x34) + 0x34 : 0x40;
		const getHeaderWord = address => version >= 0x150 && headerSize >= address + 4 ? vgm.getDoubleWord(address) : 0;
		const getChipFrequency = address => getHeaderWord(address) & 0x3FFFFFFF;

		const track = new Track(name, 44100);
		let opl4ROMSize = 0x200000;

		if (getChipFrequency(0x44)) {
			track.addCommand(CommandOPNConfig.of(getChipFrequency(0x44), "ym2203"));
		} else if (getChipFrequency(0x2C)) {
			track.addCommand(CommandOPNConfig.of(getChipFrequency(0x2C), "ym2612"));
		} else if (getChipFrequency(0x48)) {
			track.addCommand(CommandOPNConfig.of(getChipFrequency(0x48), "ym2608"));
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

		if (getHeaderWord(0x14)) {
			const gd3Address = getHeaderWord(0x14) + 0x14;
			if (vgm.getDoubleWord(gd3Address) == GD3_MAGIC_NUMBER && vgm.getDoubleWord(gd3Address + 4) == 0x0100) {
				const length = vgm.getDoubleWord(gd3Address + 8);
				const tag = vgm.data.subarray(gd3Address + 12, gd3Address + 12 + length).toString("utf16le");
				track.addCommand(CommandGD3.of(tag));
			}
		}

		let address = headerSize;
		while (address < vgm.length) {
			if (address == loop) {
				track.addCommand(CommandLabel.of("loop"));
			}
			const type = vgm.getByte(address++);
			if (type == 0x55) {
				const register = vgm.getByte(address++);
				const value = vgm.getByte(address++);
				track.addCommand(CommandOPNRegister.of(register, value));
			} else if (type == 0xA5) {
				const register = vgm.getByte(address++);
				let value = vgm.getByte(address++);
				if (register == 0x28) {
					track.addCommand(CommandOPNRegister.of(register, value | 0x04));
				} else if (register >= 0x2D && register < 0x30) {
					track.addCommand(CommandOPNRegister.of(register, value));
				} else {
					track.addCommand(CommandOPNRegister.of(0x100 | register, value));
				}
			} else if (type == 0x52) {
				const register = vgm.getByte(address++);
				const value = vgm.getByte(address++);
				track.addCommand(CommandOPNRegister.of(register, value));
			} else if (type == 0x53) {
				const register = vgm.getByte(address++);
				const value = vgm.getByte(address++);
				track.addCommand(CommandOPNRegister.of(0x100 | register, value));
			} else if (type == 0x56) {
				const register = vgm.getByte(address++);
				const value = vgm.getByte(address++);
				track.addCommand(CommandOPNRegister.of(register, value));
			} else if (type == 0x57) {
				const register = vgm.getByte(address++);
				const value = vgm.getByte(address++);
				track.addCommand(CommandOPNRegister.of(0x100 | register, value));
			} else if (type == 0x5A) {
				const register = vgm.getByte(address++);
				const value = vgm.getByte(address++);
				track.addCommand(CommandOPL4Register.of(register, value));
			} else if (type == 0x5B) {
				const register = vgm.getByte(address++);
				const value = vgm.getByte(address++);
				track.addCommand(CommandOPL4Register.of(register, value));
			} else if (type == 0x5C) {
				const register = vgm.getByte(address++);
				const value = vgm.getByte(address++);
				track.addCommand(CommandOPL4Register.of(register, value));
			} else if (type == 0x5E) {
				const register = vgm.getByte(address++);
				const value = vgm.getByte(address++);
				track.addCommand(CommandOPL4Register.of(register, value));
			} else if (type == 0x5F) {
				const register = vgm.getByte(address++);
				const value = vgm.getByte(address++);
				track.addCommand(CommandOPL4Register.of(0x100 | register, value));
			} else if (type == 0xD0) {
				const port = vgm.getByte(address++);
				const register = vgm.getByte(address++);
				const value = vgm.getByte(address++);
				track.addCommand(CommandOPL4Register.of(port << 8 | register, value));
			} else if (type == 0x61) {
				track.addCommand(CommandWait.of(vgm.getWord(address)));
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
				if (vgm.getByte(address++) != 0x66)
					throw new Error(`Invalid data block sequence at address 0x${(address - 1).toString(16).toUpperCase()}`);
				const dataType = vgm.getByte(address++);
				const dataSize = vgm.getDoubleWord(address);
				address += 4;
				if (dataType >= 0x80 && dataType < 0xC0) {
					const memorySize = vgm.getDoubleWord(address);
					const dataStart = vgm.getDoubleWord(address + 4);
					const data = vgm.data.subarray(address + 8, address + dataSize);
					if (dataType == 0x84) {
						opl4ROMSize = memorySize;
						track.addCommand(CommandOPL4WaveMemory.of(dataStart, data));
					} else if (dataType == 0x87) {
						track.addCommand(CommandOPL4WaveMemory.of(opl4ROMSize + dataStart, data));
					}
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

	async saveTrack(track, path) {
		const vgm = this.writeTrack(track);
		await fs.promises.writeFile(path, Buffer.from(vgm.data));
	}

	writeTrack(track) {
		const vgm = new VGMData(Array(0x80).fill(0));
		vgm.setDoubleWord(0x00, VGM_MAGIC_NUMBER);
		vgm.setDoubleWord(0x08, 0x151);
		vgm.setDoubleWord(0x34, vgm.length - 0x34);

		this.writeInitial(vgm);

		let samples = 0;
		let loopOffset = -1;
		let loopSamples = -1;
		for (const command of track.commands) {
			this.writeCommand(vgm, command);
			if (command instanceof CommandWait) {
				let ticks = Math.round(command.ticks * 44100 / track.tickFrequency);
				samples += ticks;
				while (ticks > 0) {
					const ticksCapped = Math.min(ticks, 65535);
					vgm.add(0x61, ticksCapped & 0xFF, ticksCapped >> 8);
					ticks -= ticksCapped;
				}
			} else if (command instanceof CommandLabel && track.isLoopLabel(command)) {
				loopOffset = vgm.length;
				loopSamples = samples;
			}
		}
		vgm.add(0x66);

		const gd3Command = track.getSetupCommand(command => command instanceof CommandGD3);
		if (gd3Command) {
			vgm.setDoubleWord(0x14, vgm.length - 0x14);
			vgm.addDoubleWord(GD3_MAGIC_NUMBER);
			vgm.addDoubleWord(0x0100);
			const tag = Buffer.from(gd3Command.tag, "utf16le");
			vgm.addDoubleWord(tag.length);
			vgm.addArray(tag);
		}

		vgm.setDoubleWord(0x04, vgm.length - 0x04);
		vgm.setDoubleWord(0x18, samples);
		vgm.setDoubleWord(0x1C, loopOffset >= 0 ? loopOffset - 0x1C : 0);
		vgm.setDoubleWord(0x20, loopSamples >= 0 ? samples - loopSamples : 0);
		return vgm;
	}

	writeInitial(vgm) {
	}

	writeCommand(vgm, command) {
	}
}

export class FormatVGMOPNB extends FormatVGM {
	constructor(opnbFrequency = 8000000) {
		super();
		this.opnbFrequency = opnbFrequency;
	}

	writeTrack(track) {
		const vgm = super.writeTrack(track);
		vgm.setDoubleWord(0x4C, this.opnbFrequency);  // 4C YM2610 / YM2610B clock
		return vgm;
	}

	writeCommand(vgm, command) {
		if (command instanceof CommandFMKey) {
			vgm.add(0x58, 0x28, command.slots << 4 | command.channel);
		} else if (command instanceof CommandFMFrequency) {
			const fNumBlock = command.getFNumBlock(this.opnbFrequency / 6);
			vgm.add(0x58 + (command.channel >> 2), 0xA4 + (command.channel & 3), fNumBlock >> 8);
			vgm.add(0x58 + (command.channel >> 2), 0xA0 + (command.channel & 3), fNumBlock & 0xFF);
		} else if (command instanceof CommandFMInstrument) {
			for (let i = 0; i < 24; i++)
				vgm.add(0x58 + (command.channel >> 2), 0x30 + i * 4 + (command.channel & 3), command.parameters[i]);
			vgm.add(0x58 + (command.channel >> 2), 0xB0 + (command.channel & 3), command.parameters[24]);
		}
	}
}

export class FormatVGMOPM extends FormatVGM {
	constructor(opmFrequency = 315000000 / 88) {
		super();
		this.opmFrequency = opmFrequency;
	}

	writeTrack(track) {
		const vgm = super.writeTrack(track);
		vgm.setDoubleWord(0x30, this.opmFrequency);  // 30 YM2151 / YM2164 clock
		return vgm;
	}

	writeCommand(vgm, command) {
		if (command instanceof CommandFMKey) {
			vgm.add(0x54, 0x08, command.slots << 3 | command.channel);
		} else if (command instanceof CommandFMFrequency) {
			const keyCodeFraction = command.getKeyCodeFraction(this.opmFrequency);
			vgm.add(0x54, 0x30 + command.channel, keyCodeFraction & 0xFF);
			vgm.add(0x54, 0x28 + command.channel, keyCodeFraction >> 8);
		} else if (command instanceof CommandFMInstrument) {
			for (let i = 0; i < 24; i++)
				vgm.add(0x54, 0x40 + i * 8 + command.channel, command.parameters[i]);
			vgm.add(0x54, 0x20 + command.channel, command.parameters[24]);
		}
	}
}

export class FormatVGMOPL4 extends FormatVGM {
	constructor(opl4Frequency = 33868800) {
		super();
		this.opl4Frequency = opl4Frequency;
		this.rom = false;
	}

	writeTrack(track) {
		this.rom = track.hasSetupCommand(command => command instanceof CommandOPL4WaveMemory && command.address < 0x200000);
		const vgm = super.writeTrack(track);
		vgm.setDoubleWord(0x60, this.opl4Frequency);  // 60 YMF278B clock
		return vgm;
	}

	writeCommand(vgm, command) {
		if (command instanceof CommandOPL4Register) {
			vgm.add(0xD0, command.address >> 8, command.address & 0xFF, command.value);
		} else if (command instanceof CommandOPL4WaveMemory) {
			const size = command.memory.length + 8;
			const start = this.rom ? command.address : command.address - 0x200000;
			vgm.add(0x67, 0x66, this.rom ? 0x84 : 0x87, size & 0xFF, size >> 8 & 0xFF, size >> 16 & 0xFF, size >> 24,
				0x00, 0x00, this.rom ? 0x40 : 0x20, 0x00, start & 0xFF, start >> 8 & 0xFF, start >> 16 & 0xFF, start >> 24);
			vgm.addArray(command.memory);
		}
	}
}

class VGMData {
	constructor(data = []) {
		this.data = data;
	}

	get length() {
		return this.data.length;
	}

	add(...values) {
		this.addArray(values);
	}

	addArray(values) {
		for (const value of values)
			this.data.push(value);
	}

	addByte(value) {
		this.data.push(value & 0xFF);
	}

	addWord(value) {
		this.addByte(value);
		this.addByte(value >> 8);
	}

	addDoubleWord(value) {
		this.addWord(value);
		this.addWord(value >> 16);
	}

	getByte(address) {
		return this.data[address];
	}

	getWord(address) {
		return this.getByte(address) | this.getByte(address + 1) << 8;
	}

	getDoubleWord(address) {
		return this.getWord(address) | this.getWord(address + 2) << 16;
	}

	setByte(address, value) {
		this.data[address] = value & 0xFF;
	}

	setWord(address, value) {
		this.setByte(address, value);
		this.setByte(address + 1, value >> 8);
	}

	setDoubleWord(address, value) {
		this.setWord(address, value);
		this.setWord(address + 2, value >> 16);
	}
}
