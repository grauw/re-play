export class Chip {
	constructor(registerMasks) {
		this.registers = registerMasks.map((mask, address) => new Register(address, mask));
	}

	getRegister(address) {
		if (address < 0 || address >= this.registers.length)
			throw new Error("Register address out of range.");
		return this.registers[address];
	}

	get(address) {
		return this.getRegister(address).get();
	}

	isSet(address) {
		return this.getRegister(address).isSet();
	}

	set(address, value) {
		return this.getRegister(address).set(value);
	}

	unset(address) {
		this.getRegister(address).unset();
	}

	unsetAll() {
		for (let address = 0; address < this.registers.length; address++) {
			this.unset(address);
		}
	}
}

export class Register {
	constructor(address, mask = 0xFF, value = 0x00) {
		this.initialized = false;
		this.address = address;
		this.mask = mask;
		this.value = value;
	}

	get() {
		return this.value;
	}

	isSet() {
		return this.initialized;
	}

	set(value) {
		if (value < 0 || value >= 0x100)
			throw new Error("Register value out of range.");
		const initialized = this.mask != 0;
		const changed = this.initialized != initialized || (this.value & this.mask) != (value & this.mask);
		this.initialized = initialized;
		this.value = this.value & ~this.mask | value & this.mask;
		return changed;
	}

	unset() {
		this.initialized = false;
	}

	equals(other) {
		return (this.value & this.mask) == (other.value & other.mask);
	}
}
