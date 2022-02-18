import { peek } from "./utils.js";
import { CommandLabel, CommandJump, CommandCall, CommandReturn, CommandWait } from "./Command.js";
import { CommandFMChannel, CommandFMKey, CommandFMFrequency, CommandFMInstrument } from "./CommandFM.js";

export class Track {
	constructor(name) {
		this.name = name;
		this.commands = [];
		this.symbols = new Map();
	}

	getSymbol(name) {
		return this.symbols.get(name);
	}

	addCommand(command) {
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

	removeWaitsUnder(threshold = 0) {
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

	quantise(newTickFrequency = 315000000 / 5256768) {
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

	mapChannels(mapping = [0, 1, 2, 3, 4, 5, 6, 7]) {
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

	attenuateVolume(dB = 0) {
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
		this.name = name;
		this.position = position;
		this.command = command;
	}
}
