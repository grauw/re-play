import { MemoConstructor, HashTypedArray } from "./utils.js";
import { Command } from "./Command.js";

export class CommandOPL4 extends Command {
	toString() {
		return `OPL4`;
	}
}

export class CommandOPL4Config extends CommandOPL4 {
	constructor(clockFrequency, type) {
		super();
		this.clockFrequency = clockFrequency;
		this.type = type;
	}

	static of(clockFrequency, type) {
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
	constructor(address, value) {
		super();
		this.address = address;
		this.value = value;
	}

	static of(address, value) {
		return commandOPL4RegisterMemo.get(address, value);
	}

	get fmOperator() {
		return (this.address & 0x100 ? 18 : 0) + (this.address >> 3 & 0x3) * 6 + (this.address & 0x7);
	}

	get fmChannel() {
		if (this.address >= 0x0A0 && this.address < 0x0E0 || this.address >= 0x1A0 && this.address < 0x1E0) {
			return (this.address & 0x100 ? 9 : 0) + (this.address & 0xF) % 9;
		} else {
			return (this.address & 0x100 ? 9 : 0) + (this.address >> 3 & 0x3) * 3 + (this.address & 0x7) % 3;
		}
	}

	get waveChannel() {
		return (this.address - 0x208) % 24;
	}

	get channel() {
		return this.address < 0x200 ? this.fmChannel : 18 + this.waveChannel;
	}

	toString() {
		const hex = value => value.toString(16).toUpperCase();
		const hexByte = value => `0${hex(value)}`.slice(-2);
		const address = this.address;
		const value = this.value;
		let description = "";
		if (address < 0x200) {
			const addressLow = address & 0xFF;
			const bank = (address >> 8) + 1;
			const operator = `0${this.fmOperator + 1}`.slice(-2);
			const channel = `0${this.fmChannel + 1}`.slice(-2);
			if (addressLow >= 0x00 && addressLow < 0x01) {
				const register = address & 1;
				const test = `0000000${value.toString(2)}`.slice(-8);
				description = `FM${bank} LSI Test ${register}: ${test}`;
			} else if (addressLow >= 0x20 && addressLow < 0x36) {
				const tremolo = value >> 7 & 0x1 ? "3.7 Hz" : "Off";
				const vibrato = value >> 6 & 0x1 ? "6.0 Hz" : "Off";
				const egType = value >> 5 & 0x1 ? "Percussive" : "Normal";
				const keyScaleRate = value >> 4 & 0x1 ? "High" : "Low";
				const multiplier = ["½", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 12, 12, 15, 15][value & 0xF];
				description = `FM${bank} Ch${channel} Op${operator} Tremolo: ${tremolo}, Vibrato: ${vibrato}, EG Type: ${egType}, Key Scale Rate: ${keyScaleRate}, Multiplier: ${multiplier}`;
			} else if (addressLow >= 0x40 && addressLow < 0x56) {
				const levelKeyScale = value >> 6 & 0x3;
				const levelKeyScaleDB = [0, 3, 1.5, 6][levelKeyScale];
				const totalLevel = value & 0x3F;
				const totalLevelDB = totalLevel * -3 / 4;
				description = `FM${bank} Ch${channel} Op${operator} Level Key Scale: ${levelKeyScale} (${levelKeyScaleDB} dB/oct), Total Level: ${totalLevel} (${totalLevelDB} dB)`;
			} else if (addressLow >= 0x60 && addressLow < 0x76) {
				const attackRate = value >> 4 & 0xF;
				const decayRate = value & 0xF;
				description = `FM${bank} Ch${channel} Op${operator} Attack Rate: ${attackRate}, Decay Rate: ${decayRate}`;
			} else if (addressLow >= 0x80 && addressLow < 0x96) {
				const sustainLevel = value >> 4 & 0xF;
				const sustainLevelDB = sustainLevel == 0xF ? -93 : sustainLevel * -3;
				const releaseRate = value & 0xF;
				description = `FM${bank} Ch${channel} Op${operator} Sustain Level: ${sustainLevel} (${sustainLevelDB} dB), Release Rate: ${releaseRate}`;
			} else if (addressLow >= 0xA0 && addressLow < 0xA9) {
				description = `FM${bank} Ch${channel} F-Number Low: 0x${hexByte(value)}`;
			} else if (addressLow >= 0xB0 && addressLow < 0xB9) {
				const key = value & 0x20 ? "On" : "Off";
				const block = value >> 2 & 0x7;
				const fnumberHigh = value & 0x3;
				description = `FM${bank} Ch${channel} Key: ${key}, Block: ${block}, F-Number High: ${fnumberHigh}`;
			} else if (addressLow >= 0xC0 && addressLow < 0xC9) {
				const chd = value & 0x80 ? "On" : "Off";
				const chc = value & 0x40 ? "On" : "Off";
				const chb = value & 0x20 ? "On" : "Off";
				const cha = value & 0x10 ? "On" : "Off";
				const feedback = value >> 1 & 0x7;
				const feedbackPi = ["0", "π/16", "π/8", "π/4", "π/2", "π", "2π", "4π"][value >> 1 & 0x7];
				const connection = value & 0x1 ? "1 (AM)" : "0 (FM)";
				description = `FM${bank} Ch${channel} CHD: ${chd}, CHC: ${chc}, CHB: ${chb}, CHA: ${cha}, Feedback: ${feedback} (${feedbackPi}), Connection: ${connection}`;
			} else if (addressLow >= 0xE0 && addressLow < 0xF6) {
				const waveSelect = value & 0x7;
				description = `FM${bank} Ch${channel} Op${operator} Wave Select: ${waveSelect}`;
			} else if (address >= 0x002 && address < 0x004) {
				const timer = address & 1;
				const timerCount = 256 - value;
				const timerTime = (timer ? 1 : 4) * timer * 2736000 / 33868800;
				description = `Timer ${timer + 1} Count: ${hexByte(timerCount)} (${timerTime.toFixed(2)} ms)`;
			} else if (address == 0x004) {
				if (value & 0x80) {
					const mask = [];
					if (value & 0x40)
						mask.push("Timer 1");
					if (value & 0x20)
						mask.push("Timer 2");
					description = `Timer Control, Reset: ${mask.join(", ")}`;
				} else {
					const timer1Enable = value & 0x1 ? "On" : "Off";
					const timer2Enable = value & 0x2 ? "On" : "Off";
					description = `Timer Control, Timer 1: ${timer1Enable}, Timer 2: ${timer2Enable}`;
				}
			} else if (address == 0x008) {
				const keyboardSplit = value >> 7 & 0x1;
				description = `FM Keyboard Split Selection: ${keyboardSplit}`;
			} else if (address == 0x0BD) {
				const tremoloDepth = value & 0x80 ? "1 dB" : "4.8 dB";
				const vibratoDepth = value & 0x40 ? "7 ¢" : "14 ¢";
				const rhythm = value & 0x20 ? "On" : "Off";
				const baseDrum = value & 0x10 ? "On" : "Off";
				const snareDrum = value & 0x08 ? "On" : "Off";
				const tomTom = value & 0x04 ? "On" : "Off";
				const topCymbal = value & 0x02 ? "On" : "Off";
				const highHat = value & 0x01 ? "On" : "Off";
				description = `FM Tremolo Depth: ${tremoloDepth}, Vibrato Depth: ${vibratoDepth}, Rhythm: ${rhythm}, Base Drum: ${baseDrum}, Snare Drum: ${snareDrum}, Tom-Tom: ${tomTom}, Top Cymbal: ${topCymbal}, High Hat: ${highHat}`;
			} else if (address == 0x104) {
				const connection = value & 0x3F;
				const connectionBits = `00000${connection.toString(2)}`.slice(-6);
				description = `FM Connection: ${connectionBits}`;
			} else if (address == 0x105) {
				const new1 = value & 0x1 ? "On" : "Off";
				const new2 = value >> 1 & 0x1 ? "On" : "Off";
				description = `FM New2: ${new2}, New: ${new1}`;
			}
		} else {
			const channel = `0${this.waveChannel}`.slice(-2);
			if (address >= 0x208 && address < 0x220) {
				const waveTableLow = value;
				description = `WAVE Ch${channel} Wave Table Number Low: 0x${hexByte(waveTableLow)}`;
			} else if (address >= 0x220 && address < 0x238) {
				const fnumberLow = value >> 1;
				const waveTableHigh = value & 1;
				description = `WAVE Ch${channel} F-Number Low: 0x${hexByte(fnumberLow)}, Wave Table Number High: 0x${waveTableHigh}`;
			} else if (address >= 0x238 && address < 0x250) {
				const fnumberHigh = value & 7;
				const octave = value << 24 >> 28;
				const pseudoReverb = value & 8 ? "On" : "Off";
				description = `WAVE Ch${channel} Octave: ${octave}, Pseudo-Reverb: ${pseudoReverb}, F-Number High: 0x${fnumberHigh}`;
			} else if (address >= 0x250 && address < 0x268) {
				const totalLevel = value >> 1;
				const totalLevelDB = totalLevel == 0x7f ? "-∞" : totalLevel * -3 / 8;
				const levelDirect = value & 1 ? "On" : "Off";
				description = `WAVE Ch${channel} Total Level: 0x${hexByte(totalLevel)} (${totalLevelDB} dB), Level Direct: ${levelDirect}`;
			} else if (address >= 0x268 && address < 0x280) {
				const key = value & 0x80 ? "On" : "Off";
				const damp = value & 0x40 ? "On" : "Off";
				const lfoReset = value & 0x20 ? "On" : "Off";
				const ch = value & 0x10 ? "DO2" : "DO1";
				const panpot = value << 28 >> 28;
				const panpotLeftDB = panpot == -8 ? "-∞" : [0, -3, -6, -9, -12, -15, -18, "-∞"][panpot] ?? 0;
				const panpotRightDB = panpot == -8 ? "-∞" : [0, -3, -6, -9, -12, -15, -18, "-∞"][-panpot] ?? 0;
				description = `WAVE Ch${channel} Key: ${key}, Damp: ${damp}, LFO Reset: ${lfoReset}, CH: ${ch}, Panpot: ${panpot} (Left: ${panpotLeftDB} dB, Right: ${panpotRightDB} dB)`;
			} else if (address >= 0x280 && address < 0x298) {
				const lfoSpeed = (value >> 3) & 7;
				const lfoSpeedHz = [0.168, 2.019, 3.196, 4.206, 5.215, 5.888, 6.224, 7.066][lfoSpeed];
				const vibratoDepth = value & 7;
				const vibratoDepthCent = vibratoDepth ? `${[0, 3.378, 5.065, 6.750, 10.114, 20.170, 40.108, 79.307][vibratoDepth]} ¢` : "Off";
				description = `WAVE Ch${channel} LFO Speed: ${lfoSpeed} (${lfoSpeedHz} Hz), Vibrato Depth: ${vibratoDepth} (${vibratoDepthCent})`;
			} else if (address >= 0x298 && address < 0x2B0) {
				const attackRate = value >> 4;
				const decay1Rate = value & 15;
				description = `WAVE Ch${channel} Attack Rate: 0x${hex(attackRate)}, Decay 1 Rate: 0x${hex(decay1Rate)}`;
			} else if (address >= 0x2B0 && address < 0x2C8) {
				const decayLevel = value >> 4;
				const decayLevelDB = decayLevel == 15 ? -93 : decayLevel * -3;
				const decay2Rate = value & 15;
				description = `WAVE Ch${channel} Decay Level: 0x${hex(decayLevel)} (${decayLevelDB} dB), Decay 2 Rate: 0x${hex(decay2Rate)}`;
			} else if (address >= 0x2C8 && address < 0x2E0) {
				const rateCorrection = value >> 4;
				const releaseRate = value & 15;
				description = `WAVE Ch${channel} Rate Correction: 0x${hex(rateCorrection)}, Release Rate: 0x${hex(releaseRate)}`;
			} else if (address >= 0x2E0 && address < 0x2F8) {
				const tremoloDepth = value & 7;
				const tremoloDepthDB = tremoloDepth ? `${[0, 1.781, 2.906, 3.656, 4.406, 5.906, 7.406, 11.91][value & 7]} dB` : "Off";
				description = `WAVE Ch${channel} Tremolo Depth: ${tremoloDepth} (${tremoloDepthDB})`;
			} else if (address >= 0x2F8 && address < 0x2FA) {
				const mixControl = address & 1 ? "WAVE" : "FM";
				const right = (value >> 3) & 7;
				const rightDB = right == 7 ? "-∞" : right * -3;
				const left = value & 7;
				const leftDB = left == 7 ? "-∞" : left * -3;
				description = `${mixControl} Mix Control Left: ${left} (${leftDB} dB), Right: ${right} (${rightDB} dB)`;
			}
		}

		return `OPL4Register ${`00${hex(address)}`.slice(-3)}: ${hexByte(value)}${description ? " - " + description : ""}`;
	}
}

const commandOPL4RegisterMemo = new MemoConstructor(CommandOPL4Register);

export class CommandOPL4WaveMemory extends CommandOPL4 {
	constructor(memory, romSize, ramSize) {
		super();
		this.memory = memory instanceof HashTypedArray ? memory.array : memory;
		this.romSize = romSize;
		this.ramSize = ramSize;
	}

	static of(memory, romSize, ramSize) {
		return commandOPL4WaveMemoryMemo.get(new HashTypedArray(memory), romSize, ramSize);
	}

	toString() {
		const hex = value => value.toString(16).toUpperCase();
		return `OPL4WaveMemory ROM Size: 0x${hex(this.romSize)}, RAM Size: 0x${hex(this.ramSize)}`;
	}
}

const commandOPL4WaveMemoryMemo = new MemoConstructor(CommandOPL4WaveMemory);
