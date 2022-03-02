import { Chip } from "./Chip.js";
import { yrw801Headers } from "./YRW801Headers.js";
import { CommandOPL4Register, CommandOPL4WaveMemory } from "./CommandOPL4.js";
import { rangeMap } from "./utils.js";

export class ChipOPL4 extends Chip {
	constructor(clockFrequency = 33868800) {
		super(0x300);
		this.clockFrequency = clockFrequency;
		this.waveTables = rangeMap(24, i => new ChipOPL4WaveTable());
		this.memory = new Uint8Array(0x400000);
		this.memory.set(yrw801Headers);
		this.romSize = 0x200000;
		this.ramSize = 0x000000;
	}

	set(address, value) {
		let changed = super.set(address, value);

		if (address >= 0x208 && address < 0x220) {
			const channel = address - 0x208;
			const wtAddress = this.getWaveTableAddress(this.getWaveTableNumber(channel));
			changed = this.waveTables[channel].set(
				this.memory[wtAddress + 0] << 16 | this.memory[wtAddress + 1] << 8 | this.memory[wtAddress + 2],
				this.memory[wtAddress + 3] << 8 | this.memory[wtAddress + 4],
				this.memory[wtAddress + 5] << 8 | this.memory[wtAddress + 6]
			);
			changed = this.set(0x280 + channel, this.memory[wtAddress + 7]) || changed;
			changed = this.set(0x298 + channel, this.memory[wtAddress + 8]) || changed;
			changed = this.set(0x2B0 + channel, this.memory[wtAddress + 9]) || changed;
			changed = this.set(0x2C8 + channel, this.memory[wtAddress + 10]) || changed;
			changed = this.set(0x2E0 + channel, this.memory[wtAddress + 11]) || changed;
		}

		return changed;
	}

	unset(address) {
		super.unset(address);
		if (address >= 0x208 && address < 0x238) {
			this.waveTables[(address - 0x208) % 24].unset();
		}
	}

	getWaveTable(channel) {
		return this.waveTables[channel];
	}

	getWaveTableNumber(channel) {
		return (this.get(0x220 + channel) << 8 | this.get(0x208 + channel)) & 0x1FF;
	}

	getWaveTableAddress(index) {
		if (index < 0 || index >= 0x200)
			throw new Error("Wave table number out of range.");
		const area = this.get(0x202) >> 2 & 0x07;
		return area == 0 || index < 0x180 ? index * 12 : area * 0x80000 + (index - 0x180) * 12;
	}

	writeROMData(romSize, dataStart, data, emit) {
		this.memory = Uint8Array.from(this.memory);
		if (romSize != this.romSize) {
			this.memory.copyWithin(romSize, this.romSize);
		}
		this.romSize = romSize;
		this.memory.set(data, dataStart);
		emit(CommandOPL4WaveMemory.of(this.memory, this.romSize, this.ramSize));
	}

	writeRAMData(ramSize, dataStart, data, emit) {
		this.memory = Uint8Array.from(this.memory);
		this.ramSize = ramSize;
		this.memory.set(data, this.romSize + dataStart);
		emit(CommandOPL4WaveMemory.of(this.memory, this.romSize, this.ramSize));
	}

	writeRegister(address, value, emit) {
		if (this.set(address, value)) {
			emit(CommandOPL4Register.of(address, value));
		}
	}
}

class ChipOPL4WaveTable {
	constructor() {
		this.initialized = false;
		this.start = 0;
		this.loop = 0;
		this.end = 0;
	}

	getBits() {
		return [8, 12, 16, 0][this.start >> 22];
	}

	getStart() {
		return this.start & 0x3FFFFF;
	}

	getLoop() {
		return this.loop;
	}

	getSize() {
		return (this.end ^ 0xFFFF) + 1;
	}

	isSet() {
		return this.initialized;
	}

	set(start, loop, end) {
		const changed = !this.initialized || this.start != start || this.loop != loop || this.end != end;
		this.initialized = true;
		this.start = start;
		this.loop = loop;
		this.end = end;
		return changed;
	}

	unset() {
		this.initialized = false;
	}
}
