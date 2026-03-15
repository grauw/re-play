import { Command } from "./Command.ts";
import { CommandPSGRegister } from "./CommandPSG.ts";
import { hex, MemoConstructor } from "./utils.ts";

export type OPNType = "ym2203" | "ym2612" | "ym2608";

export abstract class CommandOPN extends Command {
	toString() {
		return `OPN`;
	}
}

export class CommandOPNConfig extends CommandOPN {
	public readonly clockFrequency: number;
	public readonly type: OPNType;

	constructor(clockFrequency: number, type: OPNType) {
		super();
		this.clockFrequency = clockFrequency;
		this.type = type;
	}

	static of(clockFrequency: number, type: OPNType) {
		return commandOPNConfigMemo.get(clockFrequency, type);
	}

	toString() {
		return `OPNConfig Clock: ${this.clockFrequency}, Type: ${this.type}`;
	}
}

const commandOPNConfigMemo = new MemoConstructor(CommandOPNConfig);

export class CommandOPNRegister extends CommandOPN {
	public readonly address: number;
	public readonly value: number;

	constructor(address: number, value: number) {
		super();
		this.address = address;
		this.value = value;
	}

	get channel() {
		return this.address == 0x028 ? this.value & 0x7 : this.address >> 8 << 2 | this.address & 0x3;
	}

	static of(address: number, value: number) {
		return commandOPNRegisterMemo.get(address, value);
	}

	toString() {
		let description = CommandOPNRegister.toDescription(this.address, this.value);
		return `OPNRegister ${hex(this.address, 3)}: ${hex(this.value, 2)}${description ? " - " + description : ""}`;
	}

	static toDescription(address: number, value: number) {
		if (address >= 0x00 && address < 0x10) {
			const description = CommandPSGRegister.toDescription(address, value);
			return `SSG ${description}`;
		} else if (address >= 0x10 && address < 0x20) {
			const description = CommandOPNRegister.toDescriptionRHYTHM(address, value);
			return `RHYTHM ${description}`;
		} else if (address >= 0x100 && address < 0x120) {
			const description = CommandOPNRegister.toDescriptionADPCM(address, value);
			return `ADPCM ${description}`;
		} else if (address >= 0x20 && address < 0x100 || address >= 0x130 && address < 0x200) {
			const description = CommandOPNRegister.toDescriptionFM(address, value);
			return `FM ${description}`;
		}
		return "";
	}

	static toDescriptionRHYTHM(address: number, value: number) {
		if (address == 0x10) {
			const dump = value & 0x80 ? "On" : "Off";
			const rim = value & 0x20 ? "On" : "Off";
			const tom = value & 0x10 ? "On" : "Off";
			const hh = value & 0x08 ? "On" : "Off";
			const top = value & 0x04 ? "On" : "Off";
			const sd = value & 0x02 ? "On" : "Off";
			const bd = value & 0x01 ? "On" : "Off";
			return `Dump: ${dump}, RIM: ${rim}, TOM: ${tom}, HH: ${hh}, TOP: ${top}, SD: ${sd}, BD: ${bd}`;
		} else if (address == 0x11) {
			const totalLevel = value & 0x3F;
			const totalLevelDB = totalLevel * 3 / 4;
			return `Total Level: ${totalLevel} (-${totalLevelDB} dB)`;
		} else if (address == 0x12) {
			return `Test`;
		} else if (address >= 0x18 && address < 0x1E) {
			const instrument = ["BD", "SD", "TOP", "HH", "TOM", "RIM"][address - 0x18];
			const left = value & 0x80 ? "L" : "-";
			const right = value & 0x40 ? "R" : "-";
			const level = value & 0x3F;
			const levelDB = level * 3 / 4;
			return `${instrument} Panning: ${left}${right}, Level: ${level} (-${levelDB} dB)`;
		}
		return "";
	}

	static toDescriptionADPCM(address: number, value: number) {
		if (address == 0x100) {
			const start = value & 0x80 ? "On" : "Off";
			const record = value & 0x40 ? "On" : "Off";
			const memoryData = value & 0x20 ? "On" : "Off";
			const repeat = value & 0x10 ? "On" : "Off";
			const speaker = (value & 0x08) != 0x00 ? "On" : "Off";
			const reset = value & 0x01 ? "On" : "Off";
			return `Start: ${start}, Record: ${record}, Memory Data: ${memoryData}, Repeat: ${repeat}, Speaker: ${speaker}, Reset: ${reset}`;
		} else if (address == 0x101) {
			const left = value & 0x80 ? "L" : "-";
			const right = value & 0x40 ? "R" : "-";
			const sample = value & 0x08 ? "On" : "Off";
			const daAD = value & 0x08 ? "On" : "Off";
			const ramType = value & 0x08 ? "On" : "Off";
			const rom = value & 0x08 ? "On" : "Off";
			return `Panning: ${left}${right}, Sample: ${sample}, DA/AD: ${daAD}, RAM Type: ${ramType}, ROM: ${rom}`;
		} else if (address == 0x102) {
			return `Start Address Low`;
		} else if (address == 0x103) {
			return `Start Address High`;
		} else if (address == 0x104) {
			return `Stop Address Low`;
		} else if (address == 0x105) {
			return `Stop Address High`;
		} else if (address == 0x106) {
			return `Prescale Low`;
		} else if (address == 0x107) {
			return `Prescale High`;
		} else if (address == 0x108) {
			return `ADPCM Data`;
		} else if (address == 0x109) {
			return `Delta-N Low`;
		} else if (address == 0x10A) {
			return `Delta-N High`;
		} else if (address == 0x10B) {
			return `Total Level`;
		} else if (address == 0x10C) {
			return `Limit Address Low`;
		} else if (address == 0x10D) {
			return `Limit Address High`;
		} else if (address == 0x10E) {
			return `DAC Data`;
		} else if (address == 0x10F) {
			return `PCM Data`;
		} else if (address == 0x110) {
			if (value & 0x80) {
				return `IRQ Reset`;
			} else {
				const zero = value & 0x10 ? "On" : "Off";
				const brdy = value & 0x08 ? "On" : "Off";
				const eos = value & 0x04 ? "On" : "Off";
				const timerB = value & 0x02 ? "On" : "Off";
				const timerA = value & 0x01 ? "On" : "Off";
				return `Mask Zero: ${zero}, BRDY: ${brdy}, EOS: ${eos}, Timer B: ${timerB}, Timer A: ${timerA}`;
			}
		}
		return "";
	}

	static toDescriptionFM(address: number, value: number) {
		if (address == 0x21) {
			return `Test`;
		} else if (address == 0x22) {
			const lfo = value & 0x08 ? "On" : "Off";
			const frequency = value & 0x07;
			return `LFO: ${lfo}, Frequency: ${frequency}`;
		} else if (address >= 0x24 && address < 0x26) {
			return `Timer A Period`;
		} else if (address == 0x26) {
			return `Timer B Period`;
		} else if (address == 0x27) {
			const mode = value & 0x40 ? "CSM" : value & 0x80 ? "Effect" : "Normal";
			const timerReset = (value & 0x20 ? "B" : "-") + (value & 0x10 ? "A" : "-");
			const timerEnable = (value & 0x08 ? "B" : "-") + (value & 0x04 ? "A" : "-");
			const timerLoad = (value & 0x02 ? "B" : "-") + (value & 0x01 ? "A" : "-");
			return `CH3 Mode: ${mode}, Timer Reset: ${timerReset}, Enable: ${timerEnable}, Load: ${timerLoad}`;
		} else if (address == 0x28) {
			const channel = (value & 0x03) != 0x03 ? (value >> 2 & 0x01) * 3 + (value & 0x03) + 1 : "??";
			const key = value & 0xF0 ? "On" : "Off";
			const operators = (value >> 4).toString(2).padStart(4, "0");
			return `Ch${channel} Key: ${key} (Ops ${operators})`;
		} else if (address == 0x29) {
			const channels = value & 0x80 ? 6 : 3;
			const zero = value & 0x10 ? "On" : "Off";
			const brdy = value & 0x08 ? "On" : "Off";
			const eos = value & 0x04 ? "On" : "Off";
			const timerB = value & 0x02 ? "On" : "Off";
			const timerA = value & 0x01 ? "On" : "Off";
			return `SCH: ${channels}, IRQ Zero: ${zero}, BRDY: ${brdy}, EOS: ${eos}, Timer B: ${timerB}, Timer A: ${timerA}`;
		} else if (address >= 0x2D && address < 0x30) {
			return `Prescaler`;
		} else if (address >= 0x30 && address < 0x100 || address >= 0x130 && address < 0x200) {
			const channel = (address & 0x03) != 0x03 ? (address >> 8) * 3 + (address & 0x03) + 1 : "??";
			const description = CommandOPNRegister.toDescriptionFMChannel(address & 0xFF, value);
			return `Ch${channel} ${description}`;
		}
		return "";
	}

	static toDescriptionFMChannel(address: number, value: number) {
		if (address >= 0x30 && address < 0xA0) {
			const operator = (address >> 2 & 0x03) + 1;
			const description = CommandOPNRegister.toDescriptionFMOperator(address, value);
			return `Op${operator} ${description}`;
		} else if (address >= 0xA0 && address < 0xA4) {
			const fnumberLow = value;
			return `F-Number Low: ${hex(fnumberLow, 2)}`;
		} else if (address >= 0xA4 && address < 0xA8) {
			const fnumberHigh = value & 0x07;
			const block = value >> 3 & 0x07;
			return `F-Number High: ${hex(fnumberHigh)}, Block: ${hex(block)}`;
		} else if (address >= 0xA8 && address < 0xAC) {
			const fnumberLow = value;
			return `3CH F-Number Low: ${hex(fnumberLow, 2)}`;
		} else if (address >= 0xAC && address < 0xB0) {
			const fnumberHigh = value & 0x07;
			const block = value >> 3 & 0x07;
			return `3CH F-Number High: ${hex(fnumberHigh)}, Block: ${hex(block)}`;
		} else if (address >= 0xB0 && address < 0xB4) {
			const feedback = value >> 3 & 0x7;
			const feedbackPi = ["0", "π/16", "π/8", "π/4", "π/2", "π", "2π", "4π"][feedback];
			const connection = value & 0x3;
			return `Feedback: ${feedback} (${feedbackPi}), Connection: ${connection}`;
		} else if (address >= 0xB4 && address < 0xB8) {
			const left = value & 0x80 ? "L" : "-";
			const right = value & 0x40 ? "R" : "-";
			const am = value >> 4 & 0x03;
			const amDB = [0, 1.4, 5.9, 11.8][am];
			const pm = value & 0x07;
			return `Panning: ${left}${right}, AM: ${am} (${amDB} dB), PM: ${pm}`;
		}
		return "";
	}

	static toDescriptionFMOperator(address: number, value: number) {
		if (address >= 0x30 && address < 0x40) {
			const detune = (value & 0x40 ? -1 : 1) * (value >> 4 & 0x03);
			const multiplier = (value & 0x0F) || "½";
			return `Detune: ${detune}, Multiplier: ${multiplier}`;
		} else if (address >= 0x40 && address < 0x50) {
			const totalLevel = value & 0x7F;
			const totalLevelDB = totalLevel * 3 / 4;
			return `Total Level: ${totalLevel} (-${totalLevelDB} dB)`;
		} else if (address >= 0x50 && address < 0x60) {
			const keyScaleRate = value >> 6;
			const attackRate = value & 0x1F;
			return `Key Scale Rate: ${keyScaleRate}, Attack Rate: ${attackRate}`;
		} else if (address >= 0x60 && address < 0x70) {
			const am = value & 0x80 ? "On" : "Off";
			const decayRate = value & 0x1F;
			return `AM: ${am}, Decay Rate: ${decayRate}`;
		} else if (address >= 0x70 && address < 0x80) {
			const sustainRate = value & 0x1F;
			return `Sustain Rate: ${sustainRate}`;
		} else if (address >= 0x80 && address < 0x90) {
			const sustainLevel = value >> 4;
			const sustainLevelDB = sustainLevel == 0xF ? 93 : sustainLevel * 3;
			const releaseRate = value & 0x0F;
			return `Sustain Level: ${sustainLevel} (-${sustainLevelDB} dB), Release Rate: ${releaseRate}`;
		} else if (address >= 0x90 && address < 0xA0) {
			const ssgEG = value & 0x0F;
			return `SSG-EG: ${hex(ssgEG)}`;
		}
		return "";
	}
}

const commandOPNRegisterMemo = new MemoConstructor(CommandOPNRegister);
