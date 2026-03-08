import { Command } from "./Command.ts";
import { bin, dec, HashTypedArray, hex, MemoConstructor } from "./utils.ts";

export type OPL4Type = "ymf278b" | "ymf262" | "ym3812" | "ym3526" | "y8950";

export abstract class CommandOPL4 extends Command {
	toString() {
		return `OPL4`;
	}
}

export class CommandOPL4Config extends CommandOPL4 {
	public readonly clockFrequency: number;
	public readonly type: OPL4Type;

	constructor(clockFrequency: number, type: OPL4Type) {
		super();
		this.clockFrequency = clockFrequency;
		this.type = type;
	}

	static of(clockFrequency: number, type: OPL4Type) {
		return commandOPL4ConfigMemo.get(clockFrequency, type);
	}

	toString() {
		return `OPL4Config Clock: ${this.clockFrequency}, Type: ${this.type}`;
	}
}

const commandOPL4ConfigMemo = new MemoConstructor(CommandOPL4Config);

export class CommandOPL4WaitLoad extends CommandOPL4 {
	static of() {
		return commandOPL4WaitLoadMemo;
	}

	toString() {
		return "OPL4WaitLoad";
	}
}

const commandOPL4WaitLoadMemo = new CommandOPL4WaitLoad();

export class CommandOPL4Register extends CommandOPL4 {
	public readonly address: number;
	public readonly value: number;

	constructor(address: number, value: number) {
		super();
		this.address = address;
		this.value = value;
	}

	static of(address: number, value: number) {
		return commandOPL4RegisterMemo.get(address, value);
	}

	get bank() {
		return this.address >> 8;
	}

	get fmOperator() {
		if (this.address < 0x200) {
			const bank = this.address >> 8;
			const addressLow = this.address & 0xFF;
			if ((addressLow >= 0x20 && addressLow < 0xA0 || addressLow >= 0xE0) && (addressLow & 0x7) < 6 && (addressLow >> 3 & 0x3) < 3) {
				return bank * 18 + (addressLow >> 3 & 0x3) * 6 + (addressLow & 0x7);
			}
		}
		return undefined;
	}

	get fmChannel() {
		if (this.address < 0x200) {
			const bank = this.address >> 8;
			const addressLow = this.address & 0xFF;
			if (addressLow >= 0xA0 && addressLow < 0xD0 && (addressLow & 0xF) < 9) {
				return bank * 9 + (addressLow & 0xF);
			} else if ((addressLow >= 0x20 && addressLow < 0xA0 || addressLow >= 0xE0) && (addressLow & 0x7) < 6 && (addressLow >> 3 & 0x3) < 3) {
				return bank * 9 + (addressLow >> 3 & 0x3) * 3 + (addressLow & 0x7) % 3;
			}
		}
		return undefined;
	}

	get waveChannel() {
		if (this.address >= 0x208 && this.address < 0x2F8) {
			return (this.address - 0x208) % 24;
		}
		return undefined;
	}

	toString() {
		const description = this.toDescription();
		return `OPL4Register ${hex(this.address, 3)}: ${hex(this.value, 2)}${description ? " - " + description : ""}`;
	}

	toDescription() {
		if (this.address < 0x200) {
			return this.toDescriptionFM();
		} else if (this.address >= 0x200 && this.address < 0x300) {
			return this.toDescriptionWAVE();
		}
		return "";
	}

	toDescriptionFM() {
		const address = this.address;
		const value = this.value;
		if (address >= 0x002 && address < 0x004) {
			const timer = address & 0x1;
			const timerCount = 256 - value;
			const timerTime = (timer ? 1 : 4) * timer * 2736000 / 33868800;
			return `Timer ${timer + 1} Count: 0x${hex(timerCount, 2)} (${timerTime.toFixed(2)} ms)`;
		} else if (address == 0x004) {
			if (value & 0x80) {
				const mask: string[] = [];
				if (value & 0x40)
					mask.push("Timer 1");
				if (value & 0x20)
					mask.push("Timer 2");
				return `Timer Control, Reset: ${mask.join(", ")}`;
			} else {
				const timer1Enable = value & 0x1 ? "On" : "Off";
				const timer2Enable = value & 0x2 ? "On" : "Off";
				return `Timer Control, Timer 1: ${timer1Enable}, Timer 2: ${timer2Enable}`;
			}
		} else if (address == 0x008) {
			const keyboardSplit = value >> 7 & 0x1;
			return `FM Keyboard Split Selection: ${keyboardSplit}`;
		} else if (address == 0x0BD) {
			const tremoloDepth = value & 0x80 ? "1 dB" : "4.8 dB";
			const vibratoDepth = value & 0x40 ? "7 ¢" : "14 ¢";
			const rhythm = value & 0x20 ? "On" : "Off";
			const baseDrum = value & 0x10 ? "On" : "Off";
			const snareDrum = value & 0x08 ? "On" : "Off";
			const tomTom = value & 0x04 ? "On" : "Off";
			const topCymbal = value & 0x02 ? "On" : "Off";
			const highHat = value & 0x01 ? "On" : "Off";
			return `FM Tremolo Depth: ${tremoloDepth}, Vibrato Depth: ${vibratoDepth}, Rhythm: ${rhythm}, Base Drum: ${baseDrum}, Snare Drum: ${snareDrum}, Tom-Tom: ${tomTom}, Top Cymbal: ${topCymbal}, High Hat: ${highHat}`;
		} else if (address == 0x104) {
			const connection = value & 0x3F;
			const connectionBits = bin(connection, 6);
			return `FM Connection: ${connectionBits}`;
		} else if (address == 0x105) {
			const new1 = value & 0x1 ? "On" : "Off";
			const new2 = value >> 1 & 0x1 ? "On" : "Off";
			return `FM New2: ${new2}, New: ${new1}`;
		} else {
			const addressLow = address & 0xFF;
			const bank = (address >> 8) + 1;
			if (addressLow >= 0x00 && addressLow < 0x01) {
				const register = address & 0x1;
				const test = value;
				return `FM${bank} LSI Test ${register}: ${bin(test, 8)}`;
			} else {
				const channel = this.fmChannel != undefined ? dec(this.fmChannel + 1, 2) : "??";
				if (addressLow >= 0x20 && addressLow < 0xA0 || addressLow >= 0xE0 && addressLow < 0x100) {
					const operator = this.fmOperator != undefined ? dec(this.fmOperator + 1, 2) : "??";
					const description = CommandOPL4Register.toDescriptionFMOperator(addressLow, value);
					return `FM${bank} Ch${channel} Op${operator} ${description}`;
				} else if (addressLow >= 0xA0 && addressLow < 0xD0) {
					const description = CommandOPL4Register.toDescriptionFMChannel(addressLow, value);
					return `FM${bank} Ch${channel} ${description}`;
				}
			}
		}
		return "";
	}

	static toDescriptionFMChannel(address: number, value: number) {
		if (address >= 0xA0 && address < 0xA9) {
			const fnumberLow = value;
			return `F-Number Low: 0x${hex(fnumberLow, 2)}`;
		} else if (address >= 0xB0 && address < 0xB9) {
			const key = value & 0x20 ? "On" : "Off";
			const block = value >> 2 & 0x7;
			const fnumberHigh = value & 0x3;
			return `Key: ${key}, Block: ${block}, F-Number High: ${fnumberHigh}`;
		} else if (address >= 0xC0 && address < 0xC9) {
			const chd = value & 0x80 ? "On" : "Off";
			const chc = value & 0x40 ? "On" : "Off";
			const chb = value & 0x20 ? "On" : "Off";
			const cha = value & 0x10 ? "On" : "Off";
			const feedback = value >> 1 & 0x7;
			const feedbackPi = ["0", "π/16", "π/8", "π/4", "π/2", "π", "2π", "4π"][feedback];
			const connection = value & 0x1 ? "1 (AM)" : "0 (FM)";
			return `CHD: ${chd}, CHC: ${chc}, CHB: ${chb}, CHA: ${cha}, Feedback: ${feedback} (${feedbackPi}), Connection: ${connection}`;
		}
		return "";
	}

	static toDescriptionFMOperator(address: number, value: number) {
		if (address >= 0x20 && address < 0x36) {
			const tremolo = value >> 7 & 0x1 ? "3.7 Hz" : "Off";
			const vibrato = value >> 6 & 0x1 ? "6.0 Hz" : "Off";
			const egType = value >> 5 & 0x1 ? "Percussive" : "Normal";
			const keyScaleRate = value >> 4 & 0x1 ? "High" : "Low";
			const multiplier = ["½", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 12, 12, 15, 15][value & 0xF];
			return `Tremolo: ${tremolo}, Vibrato: ${vibrato}, EG Type: ${egType}, Key Scale Rate: ${keyScaleRate}, Multiplier: ${multiplier}`;
		} else if (address >= 0x40 && address < 0x56) {
			const levelKeyScale = value >> 6 & 0x3;
			const levelKeyScaleDB = [0, 3, 1.5, 6][levelKeyScale];
			const totalLevel = value & 0x3F;
			const totalLevelDB = totalLevel * -3 / 4;
			return `Level Key Scale: ${levelKeyScale} (${levelKeyScaleDB} dB/oct), Total Level: 0x${hex(totalLevel, 2)} (${totalLevelDB} dB)`;
		} else if (address >= 0x60 && address < 0x76) {
			const attackRate = value >> 4 & 0xF;
			const decayRate = value & 0xF;
			return `Attack Rate: ${attackRate}, Decay Rate: ${decayRate}`;
		} else if (address >= 0x80 && address < 0x96) {
			const sustainLevel = value >> 4 & 0xF;
			const sustainLevelDB = sustainLevel == 0xF ? -93 : sustainLevel * -3;
			const releaseRate = value & 0xF;
			return `Sustain Level: ${sustainLevel} (${sustainLevelDB} dB), Release Rate: ${releaseRate}`;
		} else if (address >= 0xE0 && address < 0xF6) {
			const waveSelect = value & 0x7;
			return `Wave Select: ${waveSelect}`;
		}
		return "";
	}

	toDescriptionWAVE() {
		const address = this.address;
		const value = this.value;
		if (address == 0x202) {
			const accessMode = value & 0x1 ? "CPU" : "OPL4";
			const type = value & 0x2 ? "RAM" : "ROM";
			const header = (value >> 2 & 0x7) * 0x80000;
			return `WAVE Memory Access Mode: ${accessMode}, Type: ${type}, Header: 0x${hex(header)}`;
		} else if (address >= 0x208 && address < 0x2F8) {
			const channel = this.waveChannel != undefined ? dec(this.waveChannel + 1, 2) : "??";
			const description = CommandOPL4Register.toDescriptionWAVEChannel(address, value);
			return `WAVE Ch${channel} ${description}`;
		} else if (address >= 0x2F8 && address < 0x2FA) {
			const mixControl = address & 0x1 ? "WAVE" : "FM";
			const right = (value >> 3) & 0x7;
			const rightDB = right == 0x7 ? "-∞" : right * -3;
			const left = value & 0x7;
			const leftDB = left == 0x7 ? "-∞" : left * -3;
			return `${mixControl} Mix Control Left: ${left} (${leftDB} dB), Right: ${right} (${rightDB} dB)`;
		}
		return "";
	}

	static toDescriptionWAVEChannel(address: number, value: number) {
		if (address >= 0x208 && address < 0x220) {
			const waveTableLow = value;
			return `Wave Table Number Low: 0x${hex(waveTableLow, 2)}`;
		} else if (address >= 0x220 && address < 0x238) {
			const fnumberLow = value >> 1;
			const waveTableHigh = value & 0x1;
			return `F-Number Low: 0x${hex(fnumberLow, 2)}, Wave Table Number High: 0x${waveTableHigh}`;
		} else if (address >= 0x238 && address < 0x250) {
			const fnumberHigh = value & 0x7;
			const octave = value << 24 >> 28;
			const pseudoReverb = value & 0x8 ? "On" : "Off";
			return `Octave: ${octave}, Pseudo-Reverb: ${pseudoReverb}, F-Number High: 0x${fnumberHigh}`;
		} else if (address >= 0x250 && address < 0x268) {
			const totalLevel = value >> 1;
			const totalLevelDB = totalLevel == 0x7F ? "-∞" : totalLevel * -3 / 8;
			const levelDirect = value & 0x1 ? "On" : "Off";
			return `Total Level: 0x${hex(totalLevel, 2)} (${totalLevelDB} dB), Level Direct: ${levelDirect}`;
		} else if (address >= 0x268 && address < 0x280) {
			const key = value & 0x80 ? "On" : "Off";
			const damp = value & 0x40 ? "On" : "Off";
			const lfoReset = value & 0x20 ? "On" : "Off";
			const ch = value & 0x10 ? "DO2" : "DO1";
			const panpot = value << 28 >> 28;
			const panpotLeftDB = panpot == -8 ? "-∞" : [0, -3, -6, -9, -12, -15, -18, "-∞"][panpot] ?? 0;
			const panpotRightDB = panpot == -8 ? "-∞" : [0, -3, -6, -9, -12, -15, -18, "-∞"][-panpot] ?? 0;
			return `Key: ${key}, Damp: ${damp}, LFO Reset: ${lfoReset}, CH: ${ch}, Panpot: ${panpot} (Left: ${panpotLeftDB} dB, Right: ${panpotRightDB} dB)`;
		} else if (address >= 0x280 && address < 0x298) {
			const lfoSpeed = (value >> 3) & 0x7;
			const lfoSpeedHz = [0.168, 2.019, 3.196, 4.206, 5.215, 5.888, 6.224, 7.066][lfoSpeed];
			const vibratoDepth = value & 0x7;
			const vibratoDepthCent = vibratoDepth ? `${[0, 3.378, 5.065, 6.750, 10.114, 20.170, 40.108, 79.307][vibratoDepth]} ¢` : "Off";
			return `LFO Speed: ${lfoSpeed} (${lfoSpeedHz} Hz), Vibrato Depth: ${vibratoDepth} (${vibratoDepthCent})`;
		} else if (address >= 0x298 && address < 0x2B0) {
			const attackRate = value >> 4;
			const decay1Rate = value & 0xF;
			return `Attack Rate: 0x${hex(attackRate)}, Decay 1 Rate: 0x${hex(decay1Rate)}`;
		} else if (address >= 0x2B0 && address < 0x2C8) {
			const decayLevel = value >> 4;
			const decayLevelDB = decayLevel == 15 ? -93 : decayLevel * -3;
			const decay2Rate = value & 0xF;
			return `Decay Level: 0x${hex(decayLevel)} (${decayLevelDB} dB), Decay 2 Rate: 0x${hex(decay2Rate)}`;
		} else if (address >= 0x2C8 && address < 0x2E0) {
			const rateCorrection = value >> 4;
			const releaseRate = value & 0xF;
			return `Rate Correction: 0x${hex(rateCorrection)}, Release Rate: 0x${hex(releaseRate)}`;
		} else if (address >= 0x2E0 && address < 0x2F8) {
			const tremoloDepth = value & 0x7;
			const tremoloDepthDB = tremoloDepth ? `${[0, 1.781, 2.906, 3.656, 4.406, 5.906, 7.406, 11.91][tremoloDepth]} dB` : "Off";
			return `Tremolo Depth: ${tremoloDepth} (${tremoloDepthDB})`;
		}
		return "";
	}
}

const commandOPL4RegisterMemo = new MemoConstructor(CommandOPL4Register);

export class CommandOPL4WaveMemory extends CommandOPL4 {
	public readonly address: number;
	public readonly memory: Uint8Array;

	constructor(address: number, memory: Uint8Array | HashTypedArray) {
		super();
		this.address = address;
		this.memory = memory instanceof HashTypedArray ? memory.array : memory;
		Object.freeze(this.memory.buffer);
	}

	static of(address: number, memory: Uint8Array) {
		return commandOPL4WaveMemoryMemo.get(address, new HashTypedArray(memory));
	}

	toString() {
		return `OPL4WaveMemory Address: 0x${hex(this.address)}, Size: 0x${hex(this.memory.length)}`;
	}
}

const commandOPL4WaveMemoryMemo = new MemoConstructor(CommandOPL4WaveMemory);
