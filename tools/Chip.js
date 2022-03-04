import { rangeMap } from "./utils.js";

export class Chip {
	constructor(registerCount) {
		this.registers = rangeMap(registerCount, address => new Register(address));
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
	constructor(address) {
		this.initialized = false;
		this.address = address;
		this.value = 0;
	}

	get() {
		return this.value;
	}

	isSet() {
		return this.initialized;
	}

	set(value) {
		if (value < 0 || value >= 0x100)
			throw new Error("Register address out of range.");
		const changed = !this.initialized || this.value != value;
		this.initialized = true;
		this.value = value;
		return changed;
	}

	unset() {
		this.initialized = false;
	}

	equals(other) {
		return this.value == other.value;
	}
}
