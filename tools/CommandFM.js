import { checkTypes, MemoConstructor } from "./utils.js";
import { Command } from "./Command.js";

export class CommandFM extends Command {
}

export class CommandFMChannel extends CommandFM {
	constructor(channel) {
		checkTypes(arguments, "number");
		if (channel < 0 || channel >= 8)
			throw new Error("Channel out of range.");
		super();
		this.channel = channel;
	}
}

export class CommandFMKey extends CommandFMChannel {
	constructor(channel, slots) {
		checkTypes(arguments, "number", "number");
		super(channel);
		this.slots = slots;
	}

	static of(channel, slots) {
		return commandFMKeyMemo.get(channel, slots);
	}
}

const commandFMKeyMemo = new MemoConstructor(CommandFMKey);

export class CommandFMFrequency extends CommandFMChannel {
	constructor(channel, frequency) {
		checkTypes(arguments, "number", "number");
		super(channel);
		this.frequency = frequency;
	}

	static of(channel, frequency) {
		return commandFMFrequencyMemo.get(channel, frequency);
	}

	getFNumBlock(opnFrequency) {
		checkTypes(arguments, "number");
		const fNum = Math.min(this.frequency * ((24 << 21) / opnFrequency), 0x3FFFF);
		const block = Math.max(Math.floor(Math.log2(fNum) - 10), 0);
		const fNumRounded = fNum + Math.pow(2, block - 1);
		const blockRounded = Math.max(Math.floor(Math.log2(fNumRounded) - 10), 0);
		return blockRounded << 11 | fNumRounded >> block;
	}

	getKeyCodeFraction(opmFrequency) {
		checkTypes(arguments, "number");
		const logarithm = Math.log2(this.frequency / 440 * (3579545 / opmFrequency)) + 4 + 8 / 12;
		const keyFraction = Math.min(Math.max(Math.round(logarithm * 12 * 64), 0), 8 * 12 * 64 - 1);
		const note = Math.floor(keyFraction / 64);
		const octave = Math.floor(note / 12);
		const noteMap = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14];
		return octave << 12 | noteMap[note % 12] << 8 | keyFraction % 64 << 2;
	}

	static ofFNum(channel, fNum, opnFrequency) {
		checkTypes(arguments, "number", "number", "number");
		if (fNum < 0 || fNum > 0x3FFFF)
			throw new Error("FNum out of range.");
		return CommandFMFrequency.of(channel, fNum * (opnFrequency / (24 << 21)));
	}
}

const commandFMFrequencyMemo = new MemoConstructor(CommandFMFrequency);

export class CommandFMInstrument extends CommandFMChannel {
	constructor(channel, ...parameters) {
		checkTypes(arguments, "number");
		if (parameters.length != 25)
			throw new Error("Incorrect number of parameters.");
		super(channel);
		this.parameters = parameters;
	}

	static of(channel, ...parameters) {
		return commandFMInstrumentMemo.get(channel, ...parameters);
	}

	attenuateVolume(dB) {
		checkTypes(arguments, "number");
		const attenuate = (level, dB) => Math.min(Math.max(Math.round(level - dB * 8 / 6), 0), 127);
		const parameters = this.parameters.slice(0);
		switch (parameters[24] & 7) {
			case 7:
				parameters[4] = attenuate(parameters[4], dB);
			case 6:
			case 5:
				parameters[5] = attenuate(parameters[5], dB);
			case 4:
				parameters[6] = attenuate(parameters[6], dB);
			default:
				parameters[7] = attenuate(parameters[7], dB);
		}
		return CommandFMInstrument.of(this.channel, ...parameters);
	}
}

const commandFMInstrumentMemo = new MemoConstructor(CommandFMInstrument);
