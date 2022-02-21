import { Chip } from "./Chip.js";
import { CommandOPL4Wave } from "./CommandOPL4.js";

export class ChipOPL4 extends Chip {
	constructor(clockFrequency = 33868800) {
		super(0x300);
		this.clockFrequency = clockFrequency;
	}

	writeRegister(address, value, emit) {
		let changed = this.set(address, value);

		if (address >= 0x208 && address < 0x220) {
			const channel = (address - 0x208) % 24;
			this.unset(0x280 + channel);
			this.unset(0x298 + channel);
			this.unset(0x2B0 + channel);
			this.unset(0x2C8 + channel);
			this.unset(0x2E0 + channel);
			changed = true;
		}

		if (changed && address >= 0x208 && address < 0x2FA) {
			emit(CommandOPL4Wave.of(address & 0xFF, value));
		}
	}
}
