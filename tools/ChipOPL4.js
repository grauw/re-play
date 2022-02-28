import { Chip } from "./Chip.js";
import { yrw801Headers } from "./YRW801Headers.js";
import { CommandOPL4Wave, CommandOPL4WaveMemory } from "./CommandOPL4.js";

export class ChipOPL4 extends Chip {
	constructor(clockFrequency = 33868800) {
		super(0x300);
		this.clockFrequency = clockFrequency;
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
			changed = this.set(0x280 + channel, this.memory[wtAddress + 7]) || changed;
			changed = this.set(0x298 + channel, this.memory[wtAddress + 8]) || changed;
			changed = this.set(0x2B0 + channel, this.memory[wtAddress + 9]) || changed;
			changed = this.set(0x2C8 + channel, this.memory[wtAddress + 10]) || changed;
			changed = this.set(0x2E0 + channel, this.memory[wtAddress + 11]) || changed;
		}

		return changed;
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
		const changed = this.set(address, value);
		if (changed && address >= 0x208 && address < 0x2FA) {
			emit(CommandOPL4Wave.of(address & 0xFF, value));
		}
	}
}
