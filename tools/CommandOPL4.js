import { MemoConstructor } from "./utils.js";
import { Command } from "./Command.js";

export class CommandOPL4 extends Command {
	toString() {
		return `OPL4`;
	}
}

export class CommandOPL4WaitLoad extends CommandOPL4 {
	static of() {
		return commandOPL4WaitLoadMemo;
	}

	toString() {
		return "OPL4WaitLoad";
	}
}

const commandOPL4WaitLoadMemo = new CommandOPL4WaitLoad();

export class CommandOPL4Wave extends CommandOPL4 {
	constructor(register, value) {
		super();
		this.register = register;
		this.value = value;
	}

	static of(register, value) {
		return commandOPL4WaveMemo.get(register, value);
	}

	get channel() {
		return (this.register - 0x08) % 24;
	}

	toString() {
		const hex = value => value.toString(16).toUpperCase();
		const hexByte = value => ("0" + hex(value)).slice(-2);
		const register = this.register;
		const value = this.value;
		const channel = this.channel;
		let description = "";
		if (register >= 0x08 && register < 0x20) {
			const waveTableLow = value;
			description = `Ch${channel} Wave Table Number Low: 0x${hexByte(waveTableLow)}`;
		} else if (register >= 0x20 && register < 0x38) {
			const fnumberLow = value >> 1;
			const waveTableHigh = value & 1;
			description = `Ch${channel} F-Number Low: 0x${hexByte(fnumberLow)}, Wave Table Number High: 0x${waveTableHigh}`;
		} else if (register >= 0x38 && register < 0x50) {
			const fnumberHigh = value & 7;
			const octave = value << 24 >> 28;
			const pseudoReverb = value & 8 ? "On" : "Off";
			description = `Ch${channel} Octave: ${octave}, Pseudo-Reverb: ${pseudoReverb}, F-Number High: 0x${fnumberHigh}`;
		} else if (register >= 0x50 && register < 0x68) {
			const totalLevel = value >> 1;
			const totalLevelDB = totalLevel == 0x7f ? "-∞" : totalLevel * -3 / 8;
			const levelDirect = value & 1 ? "On" : "Off";
			description = `Ch${channel} Total Level: 0x${hexByte(totalLevel)} (${totalLevelDB} dB), Level Direct: ${levelDirect}`;
		} else if (register >= 0x68 && register < 0x80) {
			const key = value & 128 ? "On" : "Off";
			const damp = value & 64 ? "On" : "Off";
			const lfoReset = value & 32 ? "On" : "Off";
			const ch = value & 16 ? "DO2" : "DO1";
			const panpot = value << 28 >> 28;
			const panpotLeftDB = panpot == -8 ? "-∞" : [0, -3, -6, -9, -12, -15, -18, "-∞"][panpot] ?? 0;
			const panpotRightDB = panpot == -8 ? "-∞" : [0, -3, -6, -9, -12, -15, -18, "-∞"][-panpot] ?? 0;
			description = `Ch${channel} Key: ${key}, Damp: ${damp}, LFO Reset: ${lfoReset}, CH: ${ch}, Panpot: ${panpot} (Left: ${panpotLeftDB} dB, Right: ${panpotRightDB} dB)`;
		} else if (register >= 0x80 && register < 0x98) {
			const lfoSpeed = (value >> 3) & 7;
			const lfoSpeedHz = [0.168, 2.019, 3.196, 4.206, 5.215, 5.888, 6.224, 7.066][lfoSpeed];
			const vibratoDepth = value & 7;
			const vibratoDepthCent = vibratoDepth ? `${[0, 3.378, 5.065, 6.750, 10.114, 20.170, 40.108, 79.307][vibratoDepth]} ¢` : "Off";
			description = `Ch${channel} LFO Speed: ${lfoSpeed} (${lfoSpeedHz} Hz), Vibrato Depth: ${vibratoDepth} (${vibratoDepthCent})`;
		} else if (register >= 0x98 && register < 0xB0) {
			const attackRate = value >> 4;
			const decay1Rate = value & 15;
			description = `Ch${channel} Attack Rate: 0x${hex(attackRate)}, Decay 1 Rate: 0x${hex(decay1Rate)}`;
		} else if (register >= 0xB0 && register < 0xC8) {
			const decayLevel = value >> 4;
			const decayLevelDB = decayLevel == 15 ? -93 : decayLevel * -3;
			const decay2Rate = value & 15;
			description = `Ch${channel} Decay Level: 0x${hex(decayLevel)} (${decayLevelDB} dB), Decay 2 Rate: 0x${hex(decay2Rate)}`;
		} else if (register >= 0xC8 && register < 0xE0) {
			const rateCorrection = value >> 4;
			const releaseRate = value & 15;
			description = `Ch${channel} Rate Correction: 0x${hex(rateCorrection)}, Release Rate: 0x${hex(releaseRate)}`;
		} else if (register >= 0xE0 && register < 0xF8) {
			const tremoloDepth = value & 7;
			const tremoloDepthDB = tremoloDepth ? `${[0, 1.781, 2.906, 3.656, 4.406, 5.906, 7.406, 11.91][value & 7]} dB` : "Off";
			description = `Ch${channel} Tremolo Depth: ${tremoloDepth} (${tremoloDepthDB})`;
		} else if (register >= 0xF8 && register < 0xFA) {
			const mixControl = register & 1 ? "PCM" : "FM";
			const right = (value >> 3) & 7;
			const rightDB = right == 7 ? "-∞" : right * -3;
			const left = value & 7;
			const leftDB = left == 7 ? "-∞" : left * -3;
			description = `Mix Control ${mixControl} Left: ${left} (${leftDB} dB), Right: ${right} (${rightDB} dB)`;
		}

		return `OPL4Wave ${hexByte(register)}, ${hexByte(value)}${description ? " - " + description : ""}`;
	}
}

const commandOPL4WaveMemo = new MemoConstructor(CommandOPL4Wave);
