import fs from "fs";
import util from "util";
import zlib from "zlib";
import { Command, CommandGD3, CommandJump, CommandLabel, CommandReturn, CommandWait } from "./Command.ts";
import { CommandFMFrequency, CommandFMInstrument, CommandFMKey } from "./CommandFM.ts";
import { CommandMultiPCMBankRegister, CommandMultiPCMConfig, CommandMultiPCMRegister, CommandMultiPCMWaveMemory } from "./CommandMultiPCM.ts";
import { CommandOPL4Config, CommandOPL4Register, CommandOPL4WaveMemory } from "./CommandOPL4.ts";
import { CommandOPLLConfig, CommandOPLLRegister } from "./CommandOPLL.ts";
import { CommandOPNConfig, CommandOPNRegister } from "./CommandOPN.ts";
import { CommandPSGConfig, CommandPSGRegister } from "./CommandPSG.ts";
import { Format, FormatWrapper } from "./Format.ts";
import type { FormatOPL4 } from "./FormatOPL4.ts";
import type { FormatOPLLPSG } from "./FormatOPLLPSG.ts";
import type { FormatOPN } from "./FormatOPN.ts";
import { Track } from "./Track.ts";
import { hex } from "./utils.ts";

const VGM_MAGIC_NUMBER = 0x206d6756;
const GD3_MAGIC_NUMBER = 0x20336447;

export class FormatVGM extends FormatWrapper {
	constructor(baseFormat?: Format) {
		super(baseFormat, false);
	}

	getFileName(track: Track) {
		return `${track.name}.vgm`;
	}

	async loadTrack(path: string, name: string) {
		let vgmData = await fs.promises.readFile(path);
		if (vgmData[0] == 0x1f && vgmData[1] == 0x8b)  // gzip magic number
			vgmData = await util.promisify(zlib.gunzip)(vgmData);
		return this.readTrack(vgmData, name);
	}

	readTrack(vgmData: Buffer, name: string) {
		if (vgmData.readUint32LE(0x00) != VGM_MAGIC_NUMBER)
			throw new Error("Not a VGM file.");
		const version = vgmData.readUint32LE(0x08);
		const loop = vgmData.readUint32LE(0x1C) ? vgmData.readUint32LE(0x1C) + 0x1C : 0;
		const headerSize = version >= 0x150 ? vgmData.readUint32LE(0x34) + 0x34 : 0x40;
		const getHeaderWord = (address: number) => version >= 0x150 && headerSize >= address + 4 ? vgmData.readUint32LE(address) : 0;
		const getChipFrequency = (address: number) => getHeaderWord(address) & 0x3FFFFFFF;

		const track = new Track(name, 44100);

		if (getChipFrequency(0x44)) {
			track.addCommand(CommandOPNConfig.of(getChipFrequency(0x44), "ym2203"));
		}
		if (getChipFrequency(0x2C)) {
			track.addCommand(CommandOPNConfig.of(getChipFrequency(0x2C), "ym2612"));
		}
		if (getChipFrequency(0x48)) {
			track.addCommand(CommandOPNConfig.of(getChipFrequency(0x48), "ym2608"));
		}
		if (getChipFrequency(0x60)) {
			track.addCommand(CommandOPL4Config.of(getChipFrequency(0x60), "ymf278b"));
		}
		if (getChipFrequency(0x5C)) {
			track.addCommand(CommandOPL4Config.of(getChipFrequency(0x5C), "ymf262"));
		}
		if (getChipFrequency(0x50)) {
			track.addCommand(CommandOPL4Config.of(getChipFrequency(0x50), "ym3812"));
		}
		if (getChipFrequency(0x54)) {
			track.addCommand(CommandOPL4Config.of(getChipFrequency(0x54), "ym3526"));
		}
		if (getChipFrequency(0x58)) {
			track.addCommand(CommandOPL4Config.of(getChipFrequency(0x58), "y8950"));
		}
		if (getChipFrequency(0x88)) {
			track.addCommand(CommandMultiPCMConfig.of(getChipFrequency(0x88)));
		}
		if (getChipFrequency(0x10)) {
			track.addCommand(CommandOPLLConfig.of(getChipFrequency(0x10)));
		}
		if (getChipFrequency(0x74)) {
			track.addCommand(CommandPSGConfig.of(getChipFrequency(0x74)));
		}

		if (getHeaderWord(0x14)) {
			const gd3Address = getHeaderWord(0x14) + 0x14;
			if (vgmData.readUint32LE(gd3Address) == GD3_MAGIC_NUMBER && vgmData.readUint32LE(gd3Address + 4) == 0x0100) {
				const length = vgmData.readUint32LE(gd3Address + 8);
				const tag = vgmData.subarray(gd3Address + 12, gd3Address + 12 + length).toString("utf16le");
				track.addCommand(CommandGD3.of(tag));
			}
		}

		let opl4ROMSize = 0x200000;
		let multiPCMAddress = 0;
		let address = headerSize;
		while (address < vgmData.length) {
			if (address == loop) {
				track.addCommand(CommandLabel.of("loop"));
			}
			const type = vgmData.readUint8(address++);
			if (type == 0x55) {
				const register = vgmData.readUint8(address++);
				const value = vgmData.readUint8(address++);
				track.addCommand(CommandOPNRegister.of(register, value));
			} else if (type == 0xA5) {
				const register = vgmData.readUint8(address++);
				let value = vgmData.readUint8(address++);
				if (register == 0x28) {
					track.addCommand(CommandOPNRegister.of(register, value | 0x04));
				} else if (register >= 0x2D && register < 0x30) {
					track.addCommand(CommandOPNRegister.of(register, value));
				} else {
					track.addCommand(CommandOPNRegister.of(0x100 | register, value));
				}
			} else if (type == 0x51) {
				const register = vgmData.readUint8(address++);
				const value = vgmData.readUint8(address++);
				track.addCommand(CommandOPLLRegister.of(register, value));
			} else if (type == 0x52) {
				const register = vgmData.readUint8(address++);
				const value = vgmData.readUint8(address++);
				track.addCommand(CommandOPNRegister.of(register, value));
			} else if (type == 0x53) {
				const register = vgmData.readUint8(address++);
				const value = vgmData.readUint8(address++);
				track.addCommand(CommandOPNRegister.of(0x100 | register, value));
			} else if (type == 0x56) {
				const register = vgmData.readUint8(address++);
				const value = vgmData.readUint8(address++);
				track.addCommand(CommandOPNRegister.of(register, value));
			} else if (type == 0x57) {
				const register = vgmData.readUint8(address++);
				const value = vgmData.readUint8(address++);
				track.addCommand(CommandOPNRegister.of(0x100 | register, value));
			} else if (type == 0x5A) {
				const register = vgmData.readUint8(address++);
				const value = vgmData.readUint8(address++);
				track.addCommand(CommandOPL4Register.of(register, value));
			} else if (type == 0x5B) {
				const register = vgmData.readUint8(address++);
				const value = vgmData.readUint8(address++);
				track.addCommand(CommandOPL4Register.of(register, value));
			} else if (type == 0x5C) {
				const register = vgmData.readUint8(address++);
				const value = vgmData.readUint8(address++);
				track.addCommand(CommandOPL4Register.of(register, value));
			} else if (type == 0x5E) {
				const register = vgmData.readUint8(address++);
				const value = vgmData.readUint8(address++);
				track.addCommand(CommandOPL4Register.of(register, value));
			} else if (type == 0x5F) {
				const register = vgmData.readUint8(address++);
				const value = vgmData.readUint8(address++);
				track.addCommand(CommandOPL4Register.of(0x100 | register, value));
			} else if (type == 0xA0) {
				const register = vgmData.readUint8(address++);
				const value = vgmData.readUint8(address++);
				track.addCommand(CommandPSGRegister.of(register, value));
			} else if (type == 0xB5) {
				const register = vgmData.readUint8(address++);
				const value = vgmData.readUint8(address++);
				if (register == 0) {
					track.addCommand(CommandMultiPCMRegister.of(multiPCMAddress, value));
				} else if (register == 1) {
					if (value >= 0x20 || (value & 0x07) == 0x07)
						throw new Error(`Unknown channel ${value} at address ${address - 2}`);
					multiPCMAddress = multiPCMAddress & 0xE0 | value & 0x1F;
				} else if (register == 2) {
					if (value >= 8)
						throw new Error(`Unknown register ${value} at address ${address - 2}`);
					multiPCMAddress = multiPCMAddress & 0x1F | value << 5 & 0xE0;
				}
			} else if (type == 0xC3) {
				const mask = vgmData.readUint8(address++) & 0x3;
				const bank = vgmData.readUint16LE(address);
				address += 2;
				if (mask == 0x3 && !(bank & 0x8)) {
					track.addCommand(CommandMultiPCMBankRegister.of(0x10, bank / 0x10));
				} else if (mask & 0x2) {
					track.addCommand(CommandMultiPCMBankRegister.of(0x11, bank / 0x8));
				} else if (mask & 0x1) {
					track.addCommand(CommandMultiPCMBankRegister.of(0x12, bank / 0x8));
				}
			} else if (type == 0xD0) {
				const port = vgmData.readUint8(address++);
				const register = vgmData.readUint8(address++);
				const value = vgmData.readUint8(address++);
				track.addCommand(CommandOPL4Register.of(port << 8 | register, value));
			} else if (type == 0x61) {
				track.addCommand(CommandWait.of(vgmData.readUint16LE(address)));
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
				if (vgmData.readUint8(address++) != 0x66)
					throw new Error(`Invalid data block sequence at address 0x${hex(address - 1)}`);
				const dataType = vgmData.readUint8(address++);
				const dataSize = vgmData.readUint32LE(address) & 0x7fffffff;
				address += 4;
				if (dataType >= 0x80 && dataType < 0xC0) {
					const memorySize = vgmData.readUint32LE(address);
					const dataStart = vgmData.readUint32LE(address + 4);
					const data = vgmData.subarray(address + 8, address + dataSize);
					if (dataType == 0x84) {
						opl4ROMSize = memorySize;
						track.addCommand(CommandOPL4WaveMemory.of(dataStart, data));
					} else if (dataType == 0x87) {
						track.addCommand(CommandOPL4WaveMemory.of(opl4ROMSize + dataStart, data));
					} else if (dataType == 0x89) {
						track.addCommand(CommandMultiPCMWaveMemory.of(dataStart, data));
					}
				}
				address += dataSize;
			} else if (type >= 0x70 && type < 0x80) {
				track.addCommand(CommandWait.of((type & 15) + 1));
			} else {
				throw new Error(`Unsupported command 0x${hex(type, 2)} at address 0x${hex(address - 1)}`);
			}
		}
		return track;
	}

	async saveTrack(track: Track, path: string) {
		const vgm = this.writeTrack(track);
		await fs.promises.writeFile(path, Buffer.from(vgm.data));
	}

	writeTrack(track: Track) {
		const vgm = new VGMData(Array<number>(0x80).fill(0));
		vgm.setDoubleWord(0x00, VGM_MAGIC_NUMBER);
		vgm.setDoubleWord(0x08, 0x151);
		vgm.setDoubleWord(0x34, vgm.length - 0x34);

		this.writeInitial(vgm, track);

		const [lastCommand1, lastCommand2, lastCommand3] = track.commands.slice(-3);
		const idleLoop = lastCommand1 instanceof CommandLabel && lastCommand2 instanceof CommandWait &&
			lastCommand3 instanceof CommandJump && lastCommand1.name == lastCommand3.target;

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
				if (idleLoop) {
					break;
				}
				loopOffset = vgm.length;
				loopSamples = samples;
			}
		}
		vgm.add(0x66);

		const gd3Command = track.getSetupCommand(command => command instanceof CommandGD3);
		if (gd3Command instanceof CommandGD3) {
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

	writeInitial(vgm: VGMData, track: Track) {
	}

	writeCommand(vgm: VGMData, command: Command) {
	}
}

export class FormatVGMOPNB extends FormatVGM {
	private readonly opnbFrequency: number;

	constructor(baseFormat: FormatOPN) {
		super(baseFormat);
		this.opnbFrequency = baseFormat.opnFrequency;
	}

	writeInitial(vgm: VGMData, track: Track) {
		vgm.setDoubleWord(0x4C, this.opnbFrequency);  // 4C YM2610 / YM2610B clock
	}

	writeCommand(vgm: VGMData, command: Command) {
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
	private readonly opmFrequency: number;

	constructor(baseFormat: FormatOPN) {
		super(baseFormat);
		this.opmFrequency = baseFormat.opmFrequency;
	}

	writeInitial(vgm: VGMData, track: Track) {
		vgm.setDoubleWord(0x30, this.opmFrequency);  // 30 YM2151 / YM2164 clock
	}

	writeCommand(vgm: VGMData, command: Command) {
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
	private readonly opl4Frequency: number;
	private rom: boolean;

	constructor(baseFormat: FormatOPL4) {
		super(baseFormat);
		this.opl4Frequency = baseFormat.opl4Frequency;
		this.rom = false;
	}

	writeInitial(vgm: VGMData, track: Track) {
		this.rom = track.hasSetupCommand(command => command instanceof CommandOPL4WaveMemory && command.address < 0x200000);
		vgm.setDoubleWord(0x60, this.opl4Frequency);  // 60 YMF278B clock
	}

	writeCommand(vgm: VGMData, command: Command) {
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

export class FormatVGMOPLLPSG extends FormatVGM {
	private readonly opllFrequency: number;
	private readonly psgFrequency: number;

	constructor(baseFormat: FormatOPLLPSG) {
		super(baseFormat);
		this.opllFrequency = baseFormat.opllFrequency;
		this.psgFrequency = baseFormat.psgFrequency;
	}

	writeInitial(vgm: VGMData, track: Track) {
		vgm.setDoubleWord(0x10, this.opllFrequency);
		vgm.setDoubleWord(0x74, this.psgFrequency);
	}

	writeCommand(vgm: VGMData, command: Command) {
		if (command instanceof CommandOPLLRegister) {
			vgm.add(0x51, command.address, command.value);
		} else if (command instanceof CommandPSGRegister) {
			vgm.add(0xA0, command.address, command.value);
		}
	}
}

class VGMData {
	public readonly data: number[];

	constructor(data: number[] = []) {
		this.data = data;
	}

	get length() {
		return this.data.length;
	}

	add(...values: readonly number[]) {
		this.addArray(values);
	}

	addArray(values: Iterable<number>) {
		for (const value of values)
			this.data.push(value);
	}

	addByte(value: number) {
		this.data.push(value & 0xFF);
	}

	addWord(value: number) {
		this.addByte(value);
		this.addByte(value >> 8);
	}

	addDoubleWord(value: number) {
		this.addWord(value);
		this.addWord(value >> 16);
	}

	getByte(address: number) {
		return this.data[address];
	}

	getWord(address: number) {
		return this.getByte(address) | this.getByte(address + 1) << 8;
	}

	getDoubleWord(address: number) {
		return this.getWord(address) | this.getWord(address + 2) << 16;
	}

	setByte(address: number, value: number) {
		this.data[address] = value & 0xFF;
	}

	setWord(address: number, value: number) {
		this.setByte(address, value);
		this.setByte(address + 1, value >> 8);
	}

	setDoubleWord(address: number, value: number) {
		this.setWord(address, value);
		this.setWord(address + 2, value >> 16);
	}
}
