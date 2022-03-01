import { rangeMap } from "./utils.js";

export class Chip {
	constructor(registerCount) {
		this.registers = rangeMap(registerCount, i => new Register());
	}

	get(address) {
		if (address < 0 || address >= this.registers.length)
			throw new Error("Register address out of range.");
		return this.registers[address].get();
	}

	isSet(address) {
		if (address < 0 || address >= this.registers.length)
			throw new Error("Register address out of range.");
		return this.registers[address].isSet();
	}

	set(address, value) {
		if (address < 0 || address >= this.registers.length)
			throw new Error("Register address out of range.");
		return this.registers[address].set(value);
	}

	unset(address) {
		if (address < 0 || address >= this.registers.length)
			throw new Error("Register address out of range.");
		this.registers[address].unset();
	}

	unsetAll() {
		for (let address = 0; address < this.registers.length; address++) {
			this.unset(address);
		}
	}
}

export class Register {
	constructor() {
		this.initialized = false;
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
}
