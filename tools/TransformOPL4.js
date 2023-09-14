import { Transform } from "./Transform.js";
import { Track } from "./Track.js";
import { CommandWait, CommandControlFlow, CommandLabel, CommandJump } from "./Command.js";
import { CommandOPL4Config, CommandOPL4Register, CommandOPL4WaitLoad, CommandOPL4WaveMemory } from "./CommandOPL4.js";
import { ChipOPL4 } from "./ChipOPL4.js";
import { Register } from "./Chip.js";
import { Memory, Ranges } from "./Memory.js";
import { rangeMap, MemoConstructor } from "./utils.js";

const ignoreAddresses = [
	0x000, 0x001, 0x002, 0x003, 0x004, 0x100, 0x101, 0x105,
	0x200, 0x201, 0x203, 0x204, 0x205, 0x206, 0x2F8, 0x2F9
];

export class TransformOPL4FrameSanitizer extends Transform {
	apply(input) {
		if (!input.hasSetupCommand(command => command instanceof CommandOPL4Config))
			return input;
		const output = Track.new(input);
		output.addCommand(CommandOPL4Register.of(0x105, 0x03));
		const emit = command => output.addCommand(command);
		const opl4Input = new ChipOPL4();
		const opl4Output = new ChipOPL4();
		for (const address of ignoreAddresses) {
			opl4Output.getRegister(address).mask &= 0x00;
		}
		opl4Output.getRegister(0x202).mask = 0x1C;
		const fmChannels = rangeMap(18, channel => new OPL4FrameSanitizerFMChannel(channel));
		const waveChannels = rangeMap(24, channel => new OPL4FrameSanitizerWAVEChannel(channel));
		const rhythmOff = new Register(0x0BD);
		for (const command of input.commands) {
			if (command instanceof CommandOPL4Register) {
				if (command.address < 0x200) {
					if (command.fmChannel != undefined) {
						fmChannels[command.fmChannel].processRegisterWrite(opl4Input, opl4Output, command.address, command.value);
					} else if (command.address == 0x0BD) {
						const offBits = ~command.value & rhythmOff.get(0x1F) & 0x1F;
						rhythmOff.set(0, offBits);
						opl4Input.set(command.address, command.value);
					} else {
						opl4Input.set(command.address, command.value);
					}
				} else {
					if (command.waveChannel != undefined) {
						waveChannels[command.waveChannel].processRegisterWrite(opl4Input, opl4Output, command.address, command.value);
					} else {
						if (opl4Input.set(command.address, command.value)) {
							writeRegisterIfSet(opl4Output, opl4Input.getRegister(command.address), emit);
						}
					}
				}
			} else if (command instanceof CommandOPL4Config || command instanceof CommandOPL4WaveMemory) {
				opl4Input.writeCommand(command);
				opl4Output.writeCommand(command);
				output.addCommand(command);
			} else if (command instanceof CommandWait || command instanceof CommandControlFlow) {
				this.emitFrameFM(opl4Input, opl4Output, fmChannels, rhythmOff, emit);
				this.emitFrameWAVE(opl4Input, opl4Output, waveChannels, emit);
				if (command instanceof CommandLabel && input.isLoopLabel(command)) {
					this.unsetLoopChanges(input, opl4Output, fmChannels, waveChannels, command.name);
				}
				output.addCommand(command);
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}

	emitFrameFM(opl4Input, opl4Output, channels, rhythmOff, emit) {
		const connection = opl4Input.get(0x104);
		for (let i = 0; i < 6; i++) {
			if (connection >> i & 0x1) {
				let channel1 = channels[i < 3 ? i : i + 6];
				let channel2 = channels[i < 3 ? i + 3: i + 9];
				channel2.audible = channel1.audible;
				channel2.firstKeyOn = channel1.firstKeyOn;
			}
		}
		for (let i = channels.length - 1; i >= 0; i--) {
			channels[i].emitKeyOff(opl4Input, opl4Output, emit);
		}
		const rhythm = opl4Input.get(0x0BD);
		if (rhythm & 0x20) {
			if (rhythm & 0x10) {
				channels[6].audible = true;
				channels[6].firstKeyOn = true;
			}
			if (rhythm & 0x09) {
				channels[7].audible = true;
				channels[7].firstKeyOn = true;
			}
			if (rhythm & 0x06) {
				channels[8].audible = true;
				channels[8].firstKeyOn = true;
			}
		}
		if (channels.some(channel => channel.audible)) {
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x008), emit);
			writeRegisterIfSet(opl4Output, rhythmOff, emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x104), emit);
		}
		for (let i = channels.length - 1; i >= 0; i--) {
			channels[i].emit(opl4Input, opl4Output, emit);
		}
		if (channels.some(channel => channel.audible)) {
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x0BD), emit);
			rhythmOff.set(rhythm);
			rhythmOff.unset();
		}
	}

	emitFrameWAVE(opl4Input, opl4Output, channels, emit) {
		for (const channel of channels) {
			channel.processFrame(opl4Input, opl4Output);
		}
		for (const channel of channels) {
			if (channel.waveTableChanged)
				channel.emitKeyOff(opl4Input, opl4Output, emit);
		}
		for (const channel of channels) {
			if (channel.waveTableChanged)
				channel.emitWaveTable(opl4Input, opl4Output, emit);
		}
		for (const channel of channels) {
			channel.emitKeyOff(opl4Input, opl4Output, emit);
		}
		for (const channel of channels) {
			channel.emitFrequency(opl4Input, opl4Output, emit);
		}
		for (const channel of channels) {
			channel.emitTotalLevel(opl4Input, opl4Output, emit);
		}
		for (const channel of channels) {
			if (!channel.waveTableChanged)
				channel.emitLFOADSR(opl4Input, opl4Output, emit);
		}
		for (const channel of channels) {
			if (!channel.waveTableChanged)
				channel.emitKeyOn(opl4Input, opl4Output, emit);
		}
		if (channels.some(channel => channel.waveTableChanged)) {
			emit(CommandOPL4WaitLoad.of());
		}
		for (const channel of channels) {
			channel.emitLFOADSR(opl4Input, opl4Output, emit);
		}
		for (const channel of channels) {
			channel.emitKeyOn(opl4Input, opl4Output, emit);
		}
	}

	unsetLoopChanges(input, opl4Output, fmChannels, waveChannels, target) {
		const opl4Loop = new ChipOPL4();
		for (const command of input.commands) {
			opl4Loop.writeCommand(command);
			if (command instanceof CommandOPL4Register) {
				if (command.address >= 0x0B0 && command.address < 0x0B9 && command.value & 0x20 ||
					command.address >= 0x1B0 && command.address < 0x1B9 && command.value & 0x20) {
					fmChannels[command.fmChannel].firstKeyOn = true;
				}
				if (command.address >= 0x268 && command.address < 0x280 && command.value & 0x80) {
					waveChannels[command.waveChannel].firstKeyOn = true;
				}
			} else if (command instanceof CommandJump && command.target == target) {
				break;
			}
		}
		for (let address = 0x000; address < 0x300; address++) {
			if (!opl4Output.getRegister(address).equals(opl4Loop.getRegister(address))) {
				const mask = address < 0x208 || address >= 0x238 ? 0xFF : address < 0x220 ? 0x00 : 0xFE;
				opl4Output.unset(address, mask);
			}
		}
		for (let channel = 0; channel < 24; channel++) {
			if (!opl4Output.getWaveTable(channel).equals(opl4Loop.getWaveTable(channel))) {
				opl4Output.unset(0x208 + channel);
				if (!opl4Output.getRegister(0x220 + channel).equals(opl4Loop.getRegister(0x220 + channel), 0x01)) {
					opl4Output.unset(0x220 + channel, 0x01);
				}
			}
			if (opl4Loop.isSet(0x268 + channel, 0x80) && opl4Loop.get(0x268 + channel, 0x80)) {
				waveChannels[channel].audible = true;
			}
		}
	}
}

class OPL4FrameSanitizerFMChannel {
	constructor(channel) {
		const bank = Math.floor(channel / 9) << 8;
		this.channel = bank | channel % 9;
		this.operator = bank | Math.floor(channel % 9 / 3) << 3 | channel % 3;
		this.audible = false;
		this.firstKeyOn = false;
		this.keyOff = new Register(0x0B0 + this.channel);
	}

	processRegisterWrite(opl4Input, opl4Output, address, value) {
		if (address == 0x0B0 + this.channel) {
			if (value & 0x20) {
				this.audible = true;
			} else {
				this.keyOff.set(value);
			}
		}
		opl4Input.set(address, value);
	}

	emitKeyOff(opl4Input, opl4Output, emit) {
		if (this.firstKeyOn) {
			writeRegisterIfSet(opl4Output, this.keyOff, emit);
		} else {
			this.keyOff.unset();
		}
	}

	emit(opl4Input, opl4Output, emit) {
		if (this.audible) {
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x020 + this.operator), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x023 + this.operator), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x040 + this.operator), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x043 + this.operator), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x060 + this.operator), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x063 + this.operator), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x080 + this.operator), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x083 + this.operator), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x0E0 + this.operator), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x0E3 + this.operator), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x0C0 + this.channel), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x0A0 + this.channel), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x0B0 + this.channel), emit);
			this.firstKeyOn = true;
		}
	}
}

class OPL4FrameSanitizerWAVEChannel {
	constructor(channel) {
		this.channel = channel;
		this.audible = false;
		this.firstKeyOn = false;
		this.waveTableChanged = false;
		this.keyOff = new Register(0x268 + channel);
		this.totalLevelDirect = new Register(0x250 + channel);
		this.waveTableHigh = new Register(0x220 + channel);
	}

	processRegisterWrite(opl4Input, opl4Output, address, value) {
		if (address == (0x268 + this.channel)) {
			if (value & 0x10) {
				value = value & 0xE0 | 0x08;  // Use pan -8 to mute instead of CH DO2.
			}
			if (value & 0x80) {
				this.audible = true;
			} else {
				this.keyOff.set(this.keyOff.isSet(0x20) ? this.keyOff.get(0x20) | value : value);
				this.audible &&= (value & 0x0F) != 0x08;
			}
		} else if (address == (0x250 + this.channel)) {
			if (value & 1) {
				this.totalLevelDirect.set(value);
			}
		} else if (address == (0x208 + this.channel)) {
			this.waveTableHigh.set(opl4Input.get(address + 24));
		} else if (address == (0x220 + this.channel)) {
			this.waveTableHigh.set(value, 0xFE);
		}
		opl4Input.set(address, value);
	}

	processFrame(opl4Input, opl4Output) {
		if (opl4Input.getWaveTable(this.channel).equals(opl4Output.getWaveTable(this.channel))) {
			opl4Input.unset(0x208 + this.channel);
			opl4Input.unset(0x220 + this.channel, 0x01);
		}
		if (this.audible) {
			this.waveTableChanged = opl4Input.isSet(0x208 + this.channel);
			if (this.waveTableChanged) {
				this.keyOff.set(0x48, 0xDF);  // Force mute
			}
		}
	}

	emitKeyOff(opl4Input, opl4Output, emit) {
		if (this.firstKeyOn) {
			writeRegisterIfSet(opl4Output, this.keyOff, emit);
		} else {
			this.keyOff.unset();
		}
	}

	emitWaveTable(opl4Input, opl4Output, emit) {
		if (this.audible) {
			unsetRegisterIfEqual(opl4Output, this.waveTableHigh, 0x01);
			writeRegisterIfSet(opl4Output, this.waveTableHigh, emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x208 + this.channel), emit);
		}
	}

	emitFrequency(opl4Input, opl4Output, emit) {
		if (this.audible) {
			unsetRegisterIfEqual(opl4Output, opl4Input.getRegister(0x220 + this.channel), 0xFE);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x220 + this.channel), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x238 + this.channel), emit);
		}
	}

	emitTotalLevel(opl4Input, opl4Output, emit) {
		if (this.audible) {
			unsetRegisterIfEqual(opl4Output, this.totalLevelDirect, 0xFE);
			writeRegisterIfSet(opl4Output, this.totalLevelDirect, emit);
			unsetRegisterIfEqual(opl4Output, opl4Input.getRegister(0x250 + this.channel), 0xFE);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x250 + this.channel), emit);
		} else {
			this.totalLevelDirect.unset();
		}
	}

	emitLFOADSR(opl4Input, opl4Output, emit) {
		if (this.audible) {
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x280 + this.channel), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x298 + this.channel), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x2B0 + this.channel), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x2C8 + this.channel), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x2E0 + this.channel), emit);
		}
	}

	emitKeyOn(opl4Input, opl4Output, emit) {
		if (this.audible) {
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x268 + this.channel), emit);
			this.firstKeyOn = true;
		}
	}
}

function unsetRegisterIfEqual(opl4Output, register, mask = 0xFF) {
	if (register.isSet(mask) && opl4Output.getRegister(register.address).equals(register, mask)) {
		register.unset();
	}
}

function writeRegisterIfSet(opl4Output, register, emit) {
	if (register.isSet()) {
		if (opl4Output.set(register.address, register.value)) {
			emit(CommandOPL4Register.of(register.address, register.value));
		}
		register.unset();
	}
}

export class TransformOPL4EGToWaveTables extends Transform {
	apply(input) {
		if (!input.hasSetupCommand(command => command instanceof CommandOPL4Config))
			return input;
		const rom = input.hasSetupCommand(command => command instanceof CommandOPL4WaveMemory && command.address < 0x200000);
		const chip = new ChipOPL4();
		const instrumentMemo = new MemoConstructor(OPL4Instrument);
		const instruments = [];
		const outputCommands = [];
		const queuedCommands = [];
		const channelInstruments = Array(24).fill(null);
		for (const command of input.commands) {
			chip.writeCommand(command);
			if (command instanceof CommandWait || command instanceof CommandControlFlow) {
				for (let channel = 0; channel < 24; channel++) {
					if (chip.isSet(0x208 + channel)) {
						const instrument = instrumentMemo.get(
							chip.getWaveTable(channel).start, chip.getWaveTable(channel).loop, chip.getWaveTable(channel).end,
							chip.get(0x280 + channel), chip.get(0x298 + channel), chip.get(0x2B0 + channel),
							chip.get(0x2C8 + channel), chip.get(0x2E0 + channel)
						);
						chip.unset(0x208 + channel);
						if (instrument.number < 0) {
							instrument.number = instruments.length + (rom ? 0x0 : 0x180);
							instruments.push(instrument);
						}
						channelInstruments[channel] = instrument;
					}
				}
				for (let command of queuedCommands) {
					if (command instanceof CommandOPL4Register) {
						if (command.address >= 0x208 && command.address < 0x220) {
							const instrument = channelInstruments[command.waveChannel];
							command = CommandOPL4Register.of(command.address, instrument.number & 0xFF);
						} else if (command.address >= 0x220 && command.address < 0x238) {
							command = CommandOPL4Register.of(command.address, command.value & 0xFE | (rom ? 0x0 : 0x1));
						}
					}
					outputCommands.push(command);
				}
				queuedCommands.length = 0;
				outputCommands.push(command);
			} else {
				queuedCommands.push(command);
			}
		}
		if (instruments.length >= (rom ? 0x100 : 0x80))
			throw new Error("Too many different instruments.");
		const output = Track.new(input);
		output.addCommands(outputCommands.filter(command => command instanceof CommandOPL4Config || command instanceof CommandOPL4WaveMemory));
		output.addCommand(CommandOPL4WaveMemory.of(rom ? 0x0 : 0x200000, Uint8Array.from(instruments.flatMap(instrument => instrument.header))));
		output.addCommands(outputCommands.filter(command => !(command instanceof CommandOPL4Config || command instanceof CommandOPL4WaveMemory)));
		return output;
	}
}

class OPL4Instrument {
	constructor(start, loop, end, lfoVIB, adsrARD1R, adsrDLD2R, adsrRCRR, lfoAM) {
		this.header = [start >> 16, start >> 8 & 0xFF, start & 0xFF, loop >> 8, loop & 0xFF, end >> 8, end & 0xFF,
			lfoVIB, adsrARD1R, adsrDLD2R, adsrRCRR, lfoAM];
		this.number = -1;
	}
}

export class TransformOPL4StripMemory extends Transform {
	constructor(mode = "unused", margin = 8, padding = 4) {
		super();
		if (mode != "none" && mode != "unused" && mode != "coalesce" && mode != "samples" && mode != "all")
			throw new Error("Unsupported strip mode.");
		this.mode = mode;
		this.margin = margin;
		this.padding = padding;
	}

	apply(input) {
		if (this.mode == "none" || 
			!input.hasSetupCommand(command => command instanceof CommandOPL4Config) ||
			!input.hasSetupCommand(command => command instanceof CommandOPL4WaveMemory))
			return input;
		if (this.mode == "coalesce") {
			return this.applyCoalesce(input);
		} else {
			return this.applyStrip(input);
		}
	}

	applyStrip(input) {
		const ranges = new Ranges();
		const chip = new ChipOPL4();
		if (this.mode == "unused" || this.mode == "samples") {
			for (const command of input.commands) {
				chip.writeCommand(command);
				if (command instanceof CommandOPL4Register && command.address >= 0x208 && command.address < 0x220) {
					const waveTableAddress = chip.getWaveTableAddress(chip.getWaveTableNumber(command.waveChannel));
					const waveTable = chip.getWaveTable(command.waveChannel);
					ranges.add(waveTableAddress, waveTableAddress + 12);
					if (this.mode != "samples") {
						const size = Math.ceil((waveTable.getSize() + this.padding) * waveTable.getBits() / 8);
						ranges.add(waveTable.getStart(), waveTable.getStart() + size);
					}
				}
			}
		}
		chip.memory.ranges.intersect(ranges);
		chip.memory.ranges.removeGaps(this.margin);

		const output = Track.new(input);
		output.addCommands(input.commands.filter(command => command instanceof CommandOPL4Config));
		for (const [range, data] of chip.memory.getDataRanges()) {
			output.addCommand(CommandOPL4WaveMemory.of(range.start, data));
		}
		output.addCommands(input.commands.filter(command => !(command instanceof CommandOPL4Config || command instanceof CommandOPL4WaveMemory)));
		return output;
	}

	applyCoalesce(input) {
		const commands = [];
		const instruments = new Map();
		const ranges = new Ranges();
		const chip = new ChipOPL4();
		for (const command of input.commands) {
			chip.writeCommand(command);
			if (command instanceof CommandOPL4Register) {
				if (command.address >= 0x208 && command.address < 0x220) {
					const waveTableNumber = chip.getWaveTableNumber(command.waveChannel);
					const waveTable = chip.getWaveTable(command.waveChannel);
					const size = Math.ceil((waveTable.getSize() + this.padding) * waveTable.getBits() / 8);
					ranges.add(waveTable.getStart(), waveTable.getStart() + size);
					if (!instruments.has(waveTableNumber)) {
						if (instruments.size >= 0x80)
							throw new Error("Too many instruments.");
						instruments.set(waveTableNumber, 0x180 + instruments.size);
					}
					commands.push(CommandOPL4Register.of(command.address, instruments.get(waveTableNumber) & 0xFF));
				} else if (command.address >= 0x220 && command.address < 0x238) {
					commands.push(CommandOPL4Register.of(command.address, command.value | 0x1));
				} else if (command.address != 0x202 && command.address != 0x105) {
					commands.push(command);
				}
			} else {
				commands.push(command);
			}
		}
		chip.memory.ranges.intersect(ranges);
		chip.memory.ranges.removeGaps(this.margin);

		const output = Track.new(input);
		output.addCommands(commands.filter(command => command instanceof CommandOPL4Config));
		output.addCommand(CommandOPL4Register.of(0x105, 0x03));
		output.addCommand(CommandOPL4Register.of(0x202, 0x10));

		let address = 0x200600;
		const relocations = [];
		const memory = new Memory(new Uint8Array(0x400000));
		for (const [range, data] of chip.memory.getDataRanges()) {
			if (address + data.length > 0x400000)
				throw new Error("Too much sample data.");
			memory.setData(address, data);
			relocations.push({ range: range, offset: address - range.start });
			address += data.length;
		}
		for (const [oldInstrument, newInstrument] of instruments) {
			const oldAddress = chip.getWaveTableAddress(oldInstrument);
			const newAddress = 0x200000 + (newInstrument - 0x180) * 12;
			memory.setData(newAddress, chip.memory.getData(oldAddress, oldAddress + 12));
			const start = memory.get(newAddress + 0, 0x3F) << 16 | memory.get(newAddress + 1) << 8 | memory.get(newAddress + 2);
			const relocation = relocations.find(relocation => relocation.range.includes(start));
			if (relocation) {
				const newStart = start + relocation.offset;
				memory.set(newAddress + 0, newStart >> 16, 0x3F);
				memory.set(newAddress + 1, newStart >> 8);
				memory.set(newAddress + 2, newStart);
			}
		}
		for (const [range, data] of memory.getDataRanges()) {
			output.addCommand(CommandOPL4WaveMemory.of(range.start, data));
		}

		output.addCommands(commands.filter(command => !(command instanceof CommandOPL4Config || command instanceof CommandOPL4WaveMemory)));
		return output;
	}
}

export class TransformOPL4WaveMapChannels extends Transform {
	constructor(mapping = []) {
		super();
		this.mapping = mapping;
	}

	apply(input) {
		if (this.mapping.every((value, index) => value == index))
			return input;
		const output = Track.new(input);
		for (const command of input.commands) {
			if (command instanceof CommandOPL4Register && command.address >= 0x208 && command.address < 0x2F8) {
				const newChannel = this.mapping[command.waveChannel] ?? command.waveChannel;
				if (newChannel >= 0) {
					output.addCommand(CommandOPL4Register.of(command.address - command.waveChannel + newChannel, command.value));
				}
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}
}

export class TransformOPL4WaveAttenuateVolume extends Transform {
	constructor(dB = 0) {
		super();
		this.dB = dB;
	}

	apply(input) {
		if (this.dB == 0)
			return input;
		const output = Track.new(input);
		for (const command of input.commands) {
			if (command instanceof CommandOPL4Register && command.address >= 0x250 && command.address < 0x268) {
				const level = command.value >> 1;
				const direct = command.value & 0x01;
				const newLevel = level == 0x7F ? level : Math.min(Math.max(Math.round(level + this.dB * -8 / 3), 0x00), 0x7F);
				output.addCommand(CommandOPL4Register.of(command.address, newLevel << 1 | direct));
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}
}
