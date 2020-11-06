import { checkTypes, MemoConstructor, peek } from "./utils.js";

export class Track {
	constructor(name) {
		checkTypes(arguments, "string");
		this.name = name;
		this.commands = [];
		this.symbols = new Map();
	}

	getSymbol(name) {
		checkTypes(arguments, "string");
		return this.symbols.get(name);
	}

	addCommand(command) {
		checkTypes(arguments, Command);
		if (command instanceof CommandWait && peek(this.commands) instanceof CommandWait) {
			command = command.add(this.commands.pop());
		} else if (command instanceof CommandLabel) {
			if (this.symbols.has(command.name)) {
				throw new Error(`Symbol already exists: ${command.name}`);
			}
			if (peek(this.commands) instanceof CommandJump && peek(this.commands).target == command.name) {
				this.commands.pop();
			}
			this.symbols.set(command.name, new Symbol(command.name, this.commands.length, command));
		} else if (command instanceof CommandFMInstrument) {
			let tail = [];
			while (peek(this.commands) instanceof CommandFMInstrument) {
				const lastCommand = this.commands.pop();
				if (lastCommand.channel == command.channel) {
					break;
				} else {
					tail.push(lastCommand);
				}
			}
			while (tail.length > 0) {
				this.commands.push(tail.pop());
			}
		} else if (command instanceof CommandReturn) {
			if (peek(this.commands) instanceof CommandCall) {
				command = CommandJump.of(this.commands.pop().target);
			}
		}
		this.commands.push(command);
	}

	addCommands(commands) {
		checkTypes(arguments, Array);
		for (const command of commands)
			this.addCommand(command);
	}

	moveWaitAfterLoop() {
		const loop = this.getSymbol("loop");
		if (loop && this.commands[loop.position + 1] instanceof CommandWait) {
			const track = new Track(this.name);
			track.addCommands(this.commands.slice(0, loop.position));
			track.addCommand(this.commands[loop.position + 1]);
			track.addCommand(this.commands[loop.position]);
			track.addCommands(this.commands.slice(loop.position + 2, this.commands.length - 1));
			track.addCommand(this.commands[loop.position + 1]);
			track.addCommand(this.commands[this.commands.length - 1]);
			return track;
		} else {
			return this;
		}
	}

	removeWaitsUnder(threshold) {
		checkTypes(arguments, "number");
		const track = new Track(this.name);
		let accumulator = 0;
		for (const command of this.commands) {
			if (command instanceof CommandWait) {
				if (command.time >= threshold) {
					track.addCommand(CommandWait.of(command.time + accumulator, 44100));
					accumulator = 0;
				} else {
					accumulator += command.time;
				}
			} else if (command instanceof CommandLabel || command instanceof CommandJump) {
				if (accumulator > 0) {
					track.addCommand(CommandWait.of(accumulator, 44100));
					accumulator = 0;
				}
				track.addCommand(command);
			} else {
				track.addCommand(command);
			}
		}
		return track;
	}

	quantise(newTickFrequency) {
		checkTypes(arguments, "number");
		const track = new Track(this.name);
		let time = 0;
		for (const command of this.commands) {
			if (command instanceof CommandWait) {
				time += command.time * newTickFrequency;
				if (time >= command.tickFrequency) {
					const ticks = Math.floor(time / command.tickFrequency);
					track.addCommand(CommandWait.of(ticks, newTickFrequency));
					time -= ticks * command.tickFrequency;
				}
			} else {
				track.addCommand(command);
			}
		}
		return track;
	}

	trimLeadingSilence() {
		const track = new Track(this.name);
		for (let index = 0; index < this.commands.length; ++index) {
			if (!(this.commands[index] instanceof CommandWait)) {
				track.addCommands(this.commands.slice(index, this.commands.length));
				break;
			}
		}
		return track;
	}

	toFMCommands() {
		const track = new Track(this.name);
		const registers = new Array(512).fill(0);
		let clockDivider = 6;
		for (const command of this.commands) {
			if (command instanceof CommandOPNB) {
				registers[command.address] = command.value;
				const addressLSB = command.address & 0xFF;
				const channel = (command.address >> 8) << 2 | command.address & 3;
				if (command.address == 0x28) {
					track.addCommand(CommandFMKey.of(command.value & 7, command.value >> 4));
				} else if (addressLSB >= 0xA0 && addressLSB < 0xA4) {
					const value = registers[command.address + 4] << 8 | registers[command.address];
					track.addCommand(CommandFMFrequency.ofFNum(channel, (value & 0x7FF) << (value >> 11), command.clockFrequency / clockDivider));
				} else if (addressLSB >= 0x30 && addressLSB < 0x90 || addressLSB >= 0xB0 && addressLSB < 0xB4) {
					const offset = (channel >> 2) << 8 | channel & 3;
					track.addCommand(CommandFMInstrument.of(channel,
						registers[0x30 + offset], registers[0x34 + offset], registers[0x38 + offset], registers[0x3C + offset],
						registers[0x40 + offset], registers[0x44 + offset], registers[0x48 + offset], registers[0x4C + offset],
						registers[0x50 + offset], registers[0x54 + offset], registers[0x58 + offset], registers[0x5C + offset],
						registers[0x60 + offset], registers[0x64 + offset], registers[0x68 + offset], registers[0x6C + offset],
						registers[0x70 + offset], registers[0x74 + offset], registers[0x78 + offset], registers[0x7C + offset],
						registers[0x80 + offset], registers[0x84 + offset], registers[0x88 + offset], registers[0x8C + offset],
						registers[0xB0 + offset] | 0xC0
					));
				} else if (command.address >= 0x2D && command.address < 0x30) {
					clockDivider = [6, 3, 2][command.address - 0x2D];
				}
			} else {
				track.addCommand(command);
			}
		}
		return track;
	}

	mapChannels(mapping) {
		checkTypes(arguments, Array);
		const track = new Track(this.name);
		for (const command of this.commands) {
			if (command instanceof CommandFMChannel) {
				const newChannel = mapping[command.channel];
				if (newChannel < 0) {
					// skip
				} else if (command instanceof CommandFMKey) {
					track.addCommand(CommandFMKey.of(mapping[command.channel], command.slots));
				} else if (command instanceof CommandFMFrequency) {
					track.addCommand(CommandFMFrequency.of(mapping[command.channel], command.frequency));
				} else if (command instanceof CommandFMInstrument) {
					track.addCommand(CommandFMInstrument.of(mapping[command.channel], ...command.parameters));
				}
			} else {
				track.addCommand(command);
			}
		}
		return track;
	}

	attenuateVolume(dB) {
		checkTypes(arguments, "number");
		const track = new Track(this.name);
		for (const command of this.commands) {
			if (command instanceof CommandFMInstrument) {
				track.addCommand(command.attenuateVolume(dB));
			} else {
				track.addCommand(command);
			}
		}
		return track;
	}

	frequencyBeforeKeyOn() {
		const track = new Track(this.name);
		let lastCommand = null;
		for (const command of this.commands) {
			if (command instanceof CommandFMFrequency && lastCommand instanceof CommandFMKey &&
				lastCommand.slots && command.channel == lastCommand.channel) {
				track.commands.pop();
				track.addCommand(command);
				track.addCommand(lastCommand);
			} else {
				track.addCommand(command);
			}
			lastCommand = command;
		}
		return track;
	}

	getUnusedChannels() {
		const usedChannels = new Array(8).fill(false);
		const keyOnChannels = new Array(8).fill(false);
		for (const command of this.commands) {
			if (command instanceof CommandFMChannel) {
				usedChannels[command.channel] = true;
				if (command instanceof CommandFMKey && command.slots) {
					keyOnChannels[command.channel] = true;
				}
			}
		}
		const unusedChannels = [];
		for (let i = 0; i < 8; ++i) {
			if (usedChannels[i] && !keyOnChannels[i]) {
				unusedChannels.push(i);
			}
		}
		return unusedChannels;
	}
}

export class Symbol {
	constructor(name, position, command) {
		checkTypes(arguments, "string", "number", Command);
		this.name = name;
		this.position = position;
		this.command = command;
	}
}

export class Command {
	constructor() {
	}
}

export class CommandOPNB extends Command {
	constructor(address, value, clockFrequency) {
		checkTypes(arguments, "number", "number", "number");
		if (address >= 0xC0 && address < 0x100 || address >= 0x1C0)
			throw new Error("Invalid OPN register.");
		if ((address & 0xFF) >= 0x90 && (address & 0xFF) < 0xA0)
			throw new Error("SSG-EG not supported.");
		if (address == 0x27 && value & 0xC0)
			throw new Error("CSM or 3ch modes not supported.");
		super();
		this.address = address;
		this.value = value;
		this.clockFrequency = clockFrequency;
	}

	static of(address, value, clockFrequency) {
		return commandOPNBMemo.get(address, value, clockFrequency);
	}
}

const commandOPNBMemo = new MemoConstructor(CommandOPNB);

export class CommandFMChannel extends Command {
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

export class CommandWait extends Command {
	constructor(time, tickFrequency) {
		checkTypes(arguments, "number", "number");
		super();
		this.time = time;
		this.tickFrequency = tickFrequency;
	}

	static of(time, tickFrequency) {
		return commandWaitMemo.get(time, tickFrequency);
	}

	getTime(tickFrequency = this.tickFrequency) {
		checkTypes(arguments, "number");
		return tickFrequency == this.tickFrequency ? this.time : this.time * tickFrequency / this.tickFrequency;
	}

	add(other) {
		checkTypes(arguments, CommandWait);
		if (other.tickFrequency != this.tickFrequency)
			throw new Error("Base timing frequency mismatch.");
		return CommandWait.of(this.time + other.time, this.tickFrequency);
	}
}

const commandWaitMemo = new MemoConstructor(CommandWait);

export class CommandLabel extends Command {
	constructor(name) {
		checkTypes(arguments, "string");
		super();
		this.name = name;
	}

	static of(name) {
		return commandLabelMemo.get(name);
	}
}

const commandLabelMemo = new MemoConstructor(CommandLabel);

export class CommandJump extends Command {
	constructor(target) {
		checkTypes(arguments, "string");
		super();
		this.target = target;
	}

	static of(target) {
		return commandJumpMemo.get(target);
	}
}

const commandJumpMemo = new MemoConstructor(CommandJump);

export class CommandCall extends Command {
	constructor(target) {
		checkTypes(arguments, "string");
		super();
		this.target = target;
	}

	static of(target) {
		return commandCallMemo.get(target);
	}
}

const commandCallMemo = new MemoConstructor(CommandCall);

export class CommandReturn extends Command {
	static of() {
		return commandReturnMemo;
	}
}

const commandReturnMemo = new CommandReturn();
