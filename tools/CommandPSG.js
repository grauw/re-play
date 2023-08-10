import { MemoConstructor } from "./utils.js";
import { Command } from "./Command.js";

export class CommandPSG extends Command {
	toString() {
		return `PSG`;
	}
}

export class CommandPSGConfig extends CommandPSG {
	constructor(clockFrequency) {
		super();
		this.clockFrequency = clockFrequency;
		Object.freeze(this);
	}

	static of(clockFrequency, type) {
		return commandPSGConfigMemo.get(clockFrequency, type);
	}

	toString() {
		return `PSGConfig Clock: ${this.clockFrequency}`;
	}
}

const commandPSGConfigMemo = new MemoConstructor(CommandPSGConfig);

export class CommandPSGRegister extends CommandPSG {
	constructor(address, value) {
		super();
		this.address = address;
		this.value = value;
		Object.freeze(this);
	}

	static of(address, value) {
		return commandPSGRegisterMemo.get(address, value);
	}

	toString() {
		const hex = value => value.toString(16).toUpperCase();
		const hexByte = value => `0${hex(value)}`.slice(-2);
		const address = this.address;
		const value = this.value;
		let description = "";
		if (address < 0x06 && (address & 1) == 0) {
			const channel = ["A", "B", "C"][address >> 1];
			description = `Ch${channel} Tone Frequency Low: 0x${hexByte(value)}`;
		} else if (address < 0x06 && (address & 1) == 1) {
			const channel = ["A", "B", "C"][address >> 1];
			description = `Ch${channel} Tone Frequency High: 0x${hexByte(value)}`;
		} else if (address == 0x06) {
			description = `Noise Frequency: ${value}`;
		} else if (address == 0x07) {
			const toneA = value & 0x01 ? "Off" : "On";
			const toneB = value & 0x02 ? "Off" : "On";
			const toneC = value & 0x04 ? "Off" : "On";
			const noiseA = value & 0x08 ? "Off" : "On";
			const noiseB = value & 0x10 ? "Off" : "On";
			const noiseC = value & 0x20 ? "Off" : "On";
			description = `Channel Mixer Tone: ${toneA}, ${toneB}, ${toneC}, Noise: ${noiseA}, ${noiseB}, ${noiseC}`;
		} else if (address >= 0x08 && address < 0x0B) {
			const channel = ["A", "B", "C"][address - 0x08];
			if ((value & 0x10) == 0) {
				const level = value & 0x0F;
				const levelDB = value == 0 ? "∞" : (0x0F - level) * 3;
				description = `Ch${channel} Level: ${level} (-${levelDB} dB)`;
			} else {
				description = `Ch${channel} Level: Envelope Controlled`;
			}
		} else if (address == 0x0B) {
			description = `Envelope Frequency Low: 0x${hexByte(value)}`;
		} else if (address == 0x0C) {
			description = `Envelope Frequency High: 0x${hexByte(value)}`;
		} else if (address == 0x0D) {
			const continue_ = value & 0x08 ? "On" : "Off";
			const attack = value & 0x04 ? "On" : "Off";
			const alternate = value & 0x02 ? "On" : "Off";
			const hold = value & 0x01 ? "On" : "Off";
			description = `Envelope Shape Continue: ${continue_}, Attack: ${attack}, Alternate: ${alternate}, Hold: ${hold}`;
		}

		return `PSGRegister ${hex(address)}: ${hexByte(value)}${description ? " - " + description : ""}`;
	}
}

const commandPSGRegisterMemo = new MemoConstructor(CommandPSGRegister);
