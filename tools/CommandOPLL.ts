import { Command } from "./Command.ts";
import { hex, MemoConstructor } from "./utils.ts";

export abstract class CommandOPLL extends Command {
	toString() {
		return `OPLL`;
	}
}

export class CommandOPLLConfig extends CommandOPLL {
	public readonly clockFrequency: number;

	constructor(clockFrequency: number) {
		super();
		this.clockFrequency = clockFrequency;
	}

	static of(clockFrequency: number) {
		return commandOPLLConfigMemo.get(clockFrequency);
	}

	toString() {
		return `OPLLConfig Clock: ${this.clockFrequency}`;
	}
}

const commandOPLLConfigMemo = new MemoConstructor(CommandOPLLConfig);

export class CommandOPLLRegister extends CommandOPLL {
	public readonly address: number;
	public readonly value: number;

	constructor(address: number, value: number) {
		super();
		this.address = address;
		this.value = value;
	}

	static of(address: number, value: number) {
		return commandOPLLRegisterMemo.get(address, value);
	}

	toString() {
		const address = this.address;
		const value = this.value;
		let description = "";
		if (address == 0x00 || address == 0x01) {
			const operator = address ? "Carrier" : "Modulator";
			const tremolo = value >> 7 & 0x1 ? "3.7 Hz" : "Off";
			const vibrato = value >> 6 & 0x1 ? "6.0 Hz" : "Off";
			const egType = value >> 5 & 0x1 ? "Percussive" : "Normal";
			const keyScaleRate = value >> 4 & 0x1 ? "High" : "Low";
			const multiplier = ["½", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 12, 12, 15, 15][value & 0xF];
			description = `User ${operator} Tremolo: ${tremolo}, Vibrato: ${vibrato}, EG Type: ${egType}, Key Scale Rate: ${keyScaleRate}, Multiplier: ${multiplier}`;
		} else if (address == 0x02) {
			const levelKeyScale = value >> 6 & 0x3;
			const levelKeyScaleDB = [0, 3, 1.5, 6][levelKeyScale];
			const totalLevel = value & 0x3F;
			const totalLevelDB = totalLevel * -3 / 4;
			description = `User Modulator Level Key Scale: ${levelKeyScale} (${levelKeyScaleDB} dB/oct), Total Level: ${totalLevel} (${totalLevelDB} dB)`;
		} else if (address == 0x03) {
			const levelKeyScale = value >> 6 & 0x3;
			const levelKeyScaleDB = [0, 3, 1.5, 6][levelKeyScale];
			const carrierWave = value & 0x10 ? "Half Sine" : "Sine";
			const modulatorWave = value & 0x10 ? "Half Sine" : "Sine";
			const feedback = value & 0x7;
			const feedbackPi = ["0", "π/16", "π/8", "π/4", "π/2", "π", "2π", "4π"][feedback];
			description = `User Carrier Level Key Scale: ${levelKeyScale} (${levelKeyScaleDB} dB/oct), Carrier Wave: ${carrierWave}, Modulator Wave: ${modulatorWave}, Feedback: ${feedback} (${feedbackPi})`;
		} else if (address == 0x04 || address == 0x05) {
			const operator = address - 0x04 ? "Carrier" : "Modulator";
			const attackRate = value >> 4 & 0xF;
			const decayRate = value & 0xF;
			description = `User ${operator} Attack Rate: ${attackRate}, Decay Rate: ${decayRate}`;
		} else if (address == 0x06 || address == 0x07) {
			const operator = address - 0x06 ? "Carrier" : "Modulator";
			const sustainLevel = value >> 4 & 0xF;
			const sustainLevelDB = sustainLevel == 0xF ? -93 : sustainLevel * -3;
			const releaseRate = value & 0xF;
			description = `User ${operator} Sustain Level: ${sustainLevel} (${sustainLevelDB} dB), Release Rate: ${releaseRate}`;
		} else if (address == 0x0E) {
			const rhythm = value & 0x20 ? "On" : "Off";
			const baseDrum = value & 0x10 ? "On" : "Off";
			const snareDrum = value & 0x08 ? "On" : "Off";
			const tomTom = value & 0x04 ? "On" : "Off";
			const topCymbal = value & 0x02 ? "On" : "Off";
			const highHat = value & 0x01 ? "On" : "Off";
			description = `Rhythm: ${rhythm}, Base Drum: ${baseDrum}, Snare Drum: ${snareDrum}, Tom-Tom: ${tomTom}, Top Cymbal: ${topCymbal}, High Hat: ${highHat}`;
		} else if (address >= 0x10 && address < 0x19) {
			const channel = (address & 0x0F) + 1;
			description = `Ch${channel} F-Number Low: 0x${hex(value, 2)}`;
		} else if (address >= 0x20 && address < 0x29) {
			const channel = (address & 0x0F) + 1;
			const sustain = value & 0x20 ? "On" : "Off";
			const key = value & 0x10 ? "On" : "Off";
			const block = value >> 1 & 0x7;
			const fnumberHigh = value & 0x1;
			description = `Ch${channel} Sustain: ${sustain}, Key: ${key}, Block: ${block}, F-Number High: ${fnumberHigh}`;
		} else if (address >= 0x30 && address < 0x39) {
			const channel = (address & 0x0F) + 1;
			const instrument = value >> 4;
			const level = value & 0x0F;
			const levelDB = (0x0F - level) * 3;
			description = `Ch${channel} Instrument: ${instrument}, Level: ${level} (-${levelDB} dB)`;
		}

		return `OPLLRegister ${hex(address, 2)}: ${hex(value, 2)}${description ? " - " + description : ""}`;
	}
}

const commandOPLLRegisterMemo = new MemoConstructor(CommandOPLLRegister);
