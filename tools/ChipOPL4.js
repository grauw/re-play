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
			const waveTableNumber = (this.get(address + 24) << 8 | value) & 0x1FF;
			const egSettings = this.getWaveTableEGSettings(waveTableNumber);
			changed = this.set(0x280 + channel, egSettings[0]) || changed;
			changed = this.set(0x298 + channel, egSettings[1]) || changed;
			changed = this.set(0x2B0 + channel, egSettings[2]) || changed;
			changed = this.set(0x2C8 + channel, egSettings[3]) || changed;
			changed = this.set(0x2E0 + channel, egSettings[4]) || changed;
		}

		return changed;
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

	getWaveTableEGSettings(index) {
		if (index < 0 || index >= 0x200)
			throw new Error("Wave table number out of range.");
		const address = index < 0x180 ? index * 12 : index * 12 + (this.get(0x202) >> 2 & 7) * 0x80000;
		return [
			this.memory[address + 7],
			this.memory[address + 8],
			this.memory[address + 9],
			this.memory[address + 10],
			this.memory[address + 11]
		];
	}
}
