import { CommandFMKey, CommandFMFrequency, CommandFMInstrument } from "./CommandFM.js";

export class ChipOPN {
	constructor(clockFrequency) {
		this.clockFrequency = clockFrequency * 2;
		this.clockDividers = [6, 6];
		this.registers = new Array(512).fill(0);
	}

	writeRegister(address, value, emit) {
		const addressLow = address & 0xFF;
		const addressHigh = address >>> 8;
		if (addressHigh >= 2 || addressLow >= 0xC0)
			throw new Error("Invalid register.");
		if (addressLow >= 0x90 && addressLow < 0xA0)
			throw new Error("SSG-EG not supported.");
		if (addressLow == 0x27 && value & 0xC0)
			throw new Error("CSM or 3ch modes not supported.");

		this.registers[address] = value;
		const channel = addressHigh << 2 | addressLow & 3;
		if (addressLow == 0x28) {
			emit(CommandFMKey.of(value & 3 | addressHigh << 2, value >> 4));
		} else if (addressLow >= 0xA0 && addressLow < 0xA4) {
			const value = this.registers[address + 4] << 8 | this.registers[address];
			emit(CommandFMFrequency.ofFNum(channel, (value & 0x7FF) << (value >> 11), this.clockFrequency / this.clockDividers[addressHigh]));
		} else if (addressLow >= 0xA4 && addressLow < 0xA8) {
			// just store
		} else if (addressLow >= 0x30 && addressLow < 0x90 || addressLow >= 0xB0 && addressLow < 0xB4) {
			const offset = channel >> 2 << 8 | channel & 3;
			emit(CommandFMInstrument.of(channel,
				this.registers[0x30 + offset], this.registers[0x34 + offset], this.registers[0x38 + offset], this.registers[0x3C + offset],
				this.registers[0x40 + offset], this.registers[0x44 + offset], this.registers[0x48 + offset], this.registers[0x4C + offset],
				this.registers[0x50 + offset], this.registers[0x54 + offset], this.registers[0x58 + offset], this.registers[0x5C + offset],
				this.registers[0x60 + offset], this.registers[0x64 + offset], this.registers[0x68 + offset], this.registers[0x6C + offset],
				this.registers[0x70 + offset], this.registers[0x74 + offset], this.registers[0x78 + offset], this.registers[0x7C + offset],
				this.registers[0x80 + offset], this.registers[0x84 + offset], this.registers[0x88 + offset], this.registers[0x8C + offset],
				this.registers[0xB0 + offset] | 0xC0
			));
		} else if (addressLow >= 0x2D && addressLow < 0x30) {
			this.clockDividers[addressHigh] = [6, 3, 2][addressLow - 0x2D];
		}
	}
}
