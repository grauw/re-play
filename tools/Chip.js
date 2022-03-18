export class Chip {
	constructor(registerMasks) {
		this.registers = registerMasks.map((mask, address) => new Register(address, mask));
	}

	getRegister(address) {
		if (address < 0 || address >= this.registers.length)
			throw new Error("Register address out of range.");
		return this.registers[address];
	}

	get(address, mask) {
		return this.getRegister(address).get(mask);
	}

	isSet(address, mask) {
		return this.getRegister(address).isSet(mask);
	}

	set(address, value, mask) {
		return this.getRegister(address).set(value, mask);
	}

	unset(address, mask) {
		this.getRegister(address).unset(mask);
	}

	unsetAll(mask) {
		for (let address = 0; address < this.registers.length; address++) {
			this.unset(address, mask);
		}
	}
}

export class Register {
	constructor(address, mask = 0xFF, value = 0x00) {
		this.initialized = 0x00;
		this.address = address;
		this.mask = mask;
		this.value = value;
	}

	get(mask = 0xFF) {
		return this.value & mask;
	}

	isSet(mask = 0xFF) {
		return (this.initialized & mask) != 0;
	}

	set(value, mask = 0xFF) {
		mask &= this.mask;
		const changed = (~this.initialized | this.value ^ value) & mask;
		this.initialized |= mask;
		this.value = this.value & ~mask | value & mask;
		return changed != 0;
	}

	unset(mask = 0xFF) {
		this.initialized &= ~mask;
	}

	equals(other, mask = 0xFF) {
		return ((this.initialized ^ other.initialized | this.value & this.mask ^ other.value & other.mask) & mask) == 0;
	}
}
