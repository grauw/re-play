import { Command } from "./Command.ts";
import { hex, MemoConstructor } from "./utils.ts";

export abstract class CommandPSG extends Command {
	toString() {
		return `PSG`;
	}
}

export class CommandPSGConfig extends CommandPSG {
	public readonly clockFrequency: number;

	constructor(clockFrequency: number) {
		super();
		this.clockFrequency = clockFrequency;
	}

	static of(clockFrequency: number) {
		return commandPSGConfigMemo.get(clockFrequency);
	}

	toString() {
		return `PSGConfig Clock: ${this.clockFrequency}`;
	}
}

const commandPSGConfigMemo = new MemoConstructor(CommandPSGConfig);

export class CommandPSGRegister extends CommandPSG {
	public readonly address: number;
	public readonly value: number;

	constructor(address: number, value: number) {
		super();
		this.address = address;
		this.value = value;
	}

	static of(address: number, value: number) {
		return commandPSGRegisterMemo.get(address, value);
	}

	toString() {
		const description = CommandPSGRegister.toDescription(this.address, this.value);
		return `PSGRegister ${hex(this.address, 1)}: ${hex(this.value, 2)}${description ? " - " + description : ""}`;
	}

	static toDescription(address: number, value: number) {
		const hex = (value: number, padding = 0) => value.toString(16).toUpperCase().padStart(padding, "0");
		if (address < 0x06 && (address & 1) == 0) {
			const channel = ["A", "B", "C"][address >> 1];
			return `Ch${channel} Tone Frequency Low: 0x${hex(value, 2)}`;
		} else if (address < 0x06 && (address & 1) == 1) {
			const channel = ["A", "B", "C"][address >> 1];
			return `Ch${channel} Tone Frequency High: 0x${hex(value, 2)}`;
		} else if (address == 0x06) {
			return `Noise Frequency: ${hex(value, 2)}`;
		} else if (address == 0x07) {
			const toneA = value & 0x01 ? "Off" : "On";
			const toneB = value & 0x02 ? "Off" : "On";
			const toneC = value & 0x04 ? "Off" : "On";
			const noiseA = value & 0x08 ? "Off" : "On";
			const noiseB = value & 0x10 ? "Off" : "On";
			const noiseC = value & 0x20 ? "Off" : "On";
			return `Channel Mixer Tone: ${toneA}, ${toneB}, ${toneC}, Noise: ${noiseA}, ${noiseB}, ${noiseC}`;
		} else if (address >= 0x08 && address < 0x0B) {
			const channel = ["A", "B", "C"][address - 0x08];
			if ((value & 0x10) == 0) {
				const level = value & 0x0F;
				const levelDB = value == 0 ? "∞" : (0x0F - level) * 3;
				return `Ch${channel} Level: ${level} (-${levelDB} dB)`;
			} else {
				return `Ch${channel} Level: Envelope Controlled`;
			}
		} else if (address == 0x0B) {
			return `Envelope Frequency Low: 0x${hex(value, 2)}`;
		} else if (address == 0x0C) {
			return `Envelope Frequency High: 0x${hex(value, 2)}`;
		} else if (address == 0x0D) {
			const continue_ = value & 0x08 ? "On" : "Off";
			const attack = value & 0x04 ? "On" : "Off";
			const alternate = value & 0x02 ? "On" : "Off";
			const hold = value & 0x01 ? "On" : "Off";
			return `Envelope Shape Continue: ${continue_}, Attack: ${attack}, Alternate: ${alternate}, Hold: ${hold}`;
		}
		return "";
	}
}

const commandPSGRegisterMemo = new MemoConstructor(CommandPSGRegister);
