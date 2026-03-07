import { Command } from "./Command.ts";
import { dec, HashTypedArray, hex, MemoConstructor } from "./utils.ts";

export abstract class CommandMultiPCM extends Command {
	toString() {
		return `MultiPCM`;
	}
}

export class CommandMultiPCMConfig extends CommandMultiPCM {
	public readonly clockFrequency: number;

	constructor(clockFrequency: number) {
		super();
		this.clockFrequency = clockFrequency;
	}

	static of(clockFrequency: number) {
		return commandMultiPCMConfigMemo.get(clockFrequency);
	}

	toString() {
		return `MultiPCMConfig Clock: ${this.clockFrequency}`;
	}
}

const commandMultiPCMConfigMemo = new MemoConstructor(CommandMultiPCMConfig);

export class CommandMultiPCMRegister extends CommandMultiPCM {
	public readonly address: number;
	public readonly value: number;

	constructor(address: number, value: number) {
		super();
		this.address = address;
		this.value = value;
	}

	static of(address: number, value: number) {
		return commandMultiPCMRegisterMemo.get(address, value);
	}

	get channel() {
		return this.address & 0x1F;
	}

	get realChannel() {
		if ((this.address & 0x7) != 0x7)
			return (this.address >> 3 & 0x3) * 7 + (this.address & 0x7);
		return undefined;
	}

	get register() {
		return this.address >> 5;
	}

	toString() {
		const address = this.address;
		const value = this.value;
		let description = "";
		const channel = this.realChannel != undefined ? dec(this.realChannel + 1, 2) : "??";
		if (address >= 0x00 && address < 0x20) {
			const panpot = value << 24 >> 28;
			const panpotLeftDB = panpot == -8 ? "-∞" : [0, -3, -6, -9, -12, -15, -18, "-∞"][panpot] ?? 0;
			const panpotRightDB = panpot == -8 ? "-∞" : [0, -3, -6, -9, -12, -15, -18, "-∞"][-panpot] ?? 0;
			description = `Ch${channel} Panpot: ${panpot} (Left: ${panpotLeftDB} dB, Right: ${panpotRightDB} dB)`;
		} else if (address >= 0x20 && address < 0x40) {
			const waveTableLow = value;
			description = `Ch${channel} Wave Table Number Low: 0x${hex(waveTableLow, 2)}`;
		} else if (address >= 0x40 && address < 0x60) {
			const fnumberLow = value >> 2;
			const waveTableHigh = value & 0x1;
			description = `Ch${channel} F-Number Low: 0x${hex(fnumberLow, 2)}, Wave Table Number High: 0x${waveTableHigh}`;
		} else if (address >= 0x60 && address < 0x80) {
			const fnumberHigh = value & 0xF;
			const octave = value << 24 >> 28;
			description = `Ch${channel} Octave: ${octave}, F-Number High: 0x${fnumberHigh}`;
		} else if (address >= 0x80 && address < 0xA0) {
			const key = value & 0x80 ? "On" : "Off";
			description = `Ch${channel} Key: ${key}`;
		} else if (address >= 0xA0 && address < 0xC0) {
			const totalLevel = value >> 1;
			const totalLevelDB = totalLevel == 0x7F ? "-∞" : totalLevel * -3 / 8;
			const levelDirect = value & 0x1 ? "On" : "Off";
			description = `Ch${channel} Total Level: 0x${hex(totalLevel, 2)} (${totalLevelDB} dB), Level Direct: ${levelDirect}`;
		} else if (address >= 0xC0 && address < 0xE0) {
			const lfoSpeed = (value >> 3) & 0x7;
			const lfoSpeedHz = [0.168, 2.019, 3.196, 4.206, 5.215, 5.888, 6.224, 7.066][lfoSpeed];
			const vibratoDepth = value & 0x7;
			const vibratoDepthCent = vibratoDepth ? `${[0, 3.378, 5.065, 6.750, 10.114, 20.170, 40.108, 79.307][vibratoDepth]} ¢` : "Off";
			description = `Ch${channel} LFO Speed: ${lfoSpeed} (${lfoSpeedHz} Hz), Vibrato Depth: ${vibratoDepth} (${vibratoDepthCent})`;
		} else if (address >= 0xE0 && address < 0x100) {
			const tremoloDepth = value & 0x7;
			const tremoloDepthDB = tremoloDepth ? `${[0, 1.781, 2.906, 3.656, 4.406, 5.906, 7.406, 11.91][tremoloDepth]} dB` : "Off";
			description = `Ch${channel} Tremolo Depth: ${tremoloDepth} (${tremoloDepthDB})`;
		}

		return `MultiPCMRegister ${hex(address, 2)}: ${hex(value, 2)}${description ? " - " + description : ""}`;
	}
}

const commandMultiPCMRegisterMemo = new MemoConstructor(CommandMultiPCMRegister);

export class CommandMultiPCMWaveMemory extends CommandMultiPCM {
	public readonly address: number;
	public readonly memory: Uint8Array;

	constructor(address: number, memory: Uint8Array | HashTypedArray) {
		super();
		this.address = address;
		this.memory = memory instanceof HashTypedArray ? memory.array : memory;
		Object.freeze(this.memory.buffer);
	}

	static of(address: number, memory: Uint8Array) {
		return commandMultiPCMWaveMemoryMemo.get(address, new HashTypedArray(memory));
	}

	toString() {
		return `MultiPCMWaveMemory Address: 0x${hex(this.address)}, Size: 0x${hex(this.memory.length)}`;
	}
}

const commandMultiPCMWaveMemoryMemo = new MemoConstructor(CommandMultiPCMWaveMemory);

export class CommandMultiPCMBankRegister extends CommandMultiPCM {
	public readonly address: number;
	public readonly value: number;

	constructor(address: number, value: number) {
		super();
		this.address = address;
		this.value = value;
	}

	static of(address: number, value: number) {
		return commandMultiPCMBankRegisterMemo.get(address, value);
	}

	toString() {
		return `MultiPCMBankRegister ${hex(this.address, 2)}: ${hex(this.value, 2)}`;
	}
}

const commandMultiPCMBankRegisterMemo = new MemoConstructor(CommandMultiPCMBankRegister);
