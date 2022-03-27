import { Transform } from "./Transform.js";
import { Track } from "./Track.js";
import { CommandWait, CommandControlFlow, CommandLabel, CommandJump } from "./Command.js";
import { CommandOPL4Config, CommandOPL4Register, CommandOPL4WaitLoad, CommandOPL4WaveMemory } from "./CommandOPL4.js";
import { ChipOPL4 } from "./ChipOPL4.js";
import { Register } from "./Chip.js";
import { rangeMap } from "./utils.js";

const ignoreAddresses = [
	0x000, 0x001, 0x002, 0x003, 0x004, 0x100, 0x101, 0x105,
	0x200, 0x201, 0x203, 0x204, 0x205, 0x206, 0x2F8, 0x2F9
];

export class TransformOPL4FrameSanitizer extends Transform {
	apply(input) {
		if (!(input.commands[0] instanceof CommandOPL4Config))
			return input;
		const output = new Track(input.name, input.tickFrequency);
		const emit = command => output.addCommand(command);
		const opl4Input = new ChipOPL4();
		const opl4Output = new ChipOPL4();
		for (const address of ignoreAddresses) {
			opl4Output.getRegister(address).mask &= 0x00;
		}
		opl4Output.getRegister(0x202).mask = 0x1C;
		const channels = rangeMap(24, channel => new OPL4FrameSanitizerChannel(channel));
		for (const command of input.commands) {
			if (command instanceof CommandOPL4Register) {
				if (command.address >= 0x208 && command.address < 0x2F8) {
					channels[command.waveChannel].processRegisterWrite(opl4Input, opl4Output, command.address, command.value);
				} else {
					if (opl4Input.set(command.address, command.value)) {
						writeRegisterIfSet(opl4Output, opl4Input.getRegister(command.address), emit);
					}
				}
			} else if (command instanceof CommandOPL4Config || command instanceof CommandOPL4WaveMemory) {
				opl4Input.writeCommand(command);
				opl4Output.writeCommand(command);
				output.addCommand(command);
			} else if (command instanceof CommandWait || command instanceof CommandControlFlow) {
				this.emitFrame(opl4Input, opl4Output, channels, emit);
				if (command instanceof CommandLabel && input.isLoopLabel(command)) {
					this.unsetLoopChanges(input, opl4Output, channels, command.name);
				}
				output.addCommand(command);
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}

	emitFrame(opl4Input, opl4Output, channels, emit) {
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

	unsetLoopChanges(input, opl4Output, channels, target) {
		const opl4Loop = new ChipOPL4();
		for (const command of input.commands) {
			opl4Loop.writeCommand(command);
			if (command instanceof CommandOPL4Register) {
				if (command.address >= 0x268 && command.address < 0x280 && command.value & 0x80) {
					channels[command.waveChannel].firstKeyOn = true;
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
				channels[channel].audible = true;
			}
		}
	}
}

class OPL4FrameSanitizerChannel {
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
		if (address >= 0x268 && address < 0x280) {
			if (value & 0x10) {
				value = value & 0xE0 | 0x08;  // Use pan -8 to mute instead of CH DO2.
			}
			if (value & 0x80) {
				this.audible = true;
			} else {
				this.keyOff.set(this.keyOff.isSet(0x20) ? this.keyOff.get(0x20) | value : value);
				this.audible &&= (value & 0x0F) != 0x08;
			}
		} else if (address >= 0x250 && address < 0x268) {
			if (value & 1) {
				this.totalLevelDirect.set(value);
			}
		} else if (address >= 0x208 && address < 0x220) {
			this.waveTableHigh.set(opl4Input.get(address + 24));
		} else if (address >= 0x220 && address < 0x238) {
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
			if (!this.waveTableHigh.equals(opl4Output.getRegister(0x220 + this.channel), 0x01)) {
				writeRegisterIfSet(opl4Output, this.waveTableHigh, emit);
			}
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x208 + this.channel), emit);
		}
	}

	emitFrequency(opl4Input, opl4Output, emit) {
		if (this.audible) {
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x220 + this.channel), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x238 + this.channel), emit);
		}
	}

	emitTotalLevel(opl4Input, opl4Output, emit) {
		if (this.audible) {
			writeRegisterIfSet(opl4Output, this.totalLevelDirect, emit);
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

function writeRegisterIfSet(opl4Output, register, emit) {
	if (register.isSet()) {
		if (opl4Output.set(register.address, register.value)) {
			emit(CommandOPL4Register.of(register.address, register.value));
		}
		register.unset();
	}
}

export class TransformOPL4StripMemory extends Transform {
	constructor(mode = "unused", margin = 8, padding = 4) {
		super();
		if (mode != "none" && mode != "unused" && mode != "all")
			throw new Error("Unsupported strip mode.");
		this.mode = mode;
		this.margin = margin;
		this.padding = padding;
	}

	apply(input) {
		if (this.mode == "none" || !(input.commands[0] instanceof CommandOPL4Config))
			return input;
		const ranges = new Ranges();
		if (this.mode == "unused") {
			const chip = new ChipOPL4();
			for (const command of input.commands) {
				chip.writeCommand(command);
				if (command instanceof CommandOPL4Register && command.address >= 0x208 && command.address < 0x220) {
					const waveTableAddress = chip.getWaveTableAddress(chip.getWaveTableNumber(command.waveChannel));
					const waveTable = chip.getWaveTable(command.waveChannel);
					ranges.add(waveTableAddress, waveTableAddress + 12);
					ranges.add(waveTable.getStart(),
						waveTable.getStart() + Math.ceil((waveTable.getSize() + this.padding) * waveTable.getBits() / 8));
				}
			}
		}
		ranges.removeGaps(this.margin);
		const output = new Track(input.name, input.tickFrequency);
		for (const command of input.commands) {
			if (command instanceof CommandOPL4WaveMemory) {
				for (const range of ranges.ranges) {
					const start = command.address;
					const end = command.address + command.memory.length;
					if (start < range.end && end > range.start) {
						output.addCommand(CommandOPL4WaveMemory.of(
							Math.max(start, range.start),
							command.memory.subarray(Math.max(range.start - start, 0), range.end - start)
						));
					}
				}
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}
}

class Ranges {
	constructor() {
		this.ranges = [];
	}

	add(start, end) {
		let startIndex = 0;
		let endIndex = this.ranges.length - 1;
		for (let index = 0; index < this.ranges.length; index++) {
			if (start > this.ranges[index].end) {
				startIndex = index + 1;
			} else {
				break;
			}
		}
		for (let index = this.ranges.length - 1; index >= 0; index--) {
			if (end < this.ranges[index].start) {
				endIndex = index - 1;
			} else {
				break;
			}
		}
		this.ranges.splice(startIndex, endIndex - startIndex + 1, new Range(
			Math.min(start, startIndex >= 0 && startIndex < this.ranges.length ? this.ranges[startIndex].start : 0x400000),
			Math.max(end, endIndex >= 0 && endIndex < this.ranges.length ? this.ranges[endIndex].end : 0)
		));
	}

	removeGaps(size) {
		let index = 0;
		while (index < this.ranges.length - 1) {
			if (this.ranges[index + 1].start - this.ranges[index].end <= size) {
				this.ranges.splice(index, 2, new Range(this.ranges[index].start, this.ranges[index + 1].end));
			} else {
				index++;
			}
		}
	}

	toString() {
		return `[${this.ranges.join(", ")}]`;
	}
}

class Range {
	constructor(start, end) {
		this.start = start;
		this.end = end;
	}

	toString() {
		const hex = value => value.toString(16).toUpperCase();
		return `[${hex(this.start)}, ${hex(this.end)}]`;
	}
}
