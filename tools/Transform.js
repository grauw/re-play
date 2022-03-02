import { Track } from "./Track.js";
import { CommandLabel, CommandJump, CommandWait } from "./Command.js";
import { CommandFMChannel, CommandFMKey, CommandFMFrequency, CommandFMInstrument } from "./CommandFM.js";
import { CommandOPL4Register } from "./CommandOPL4.js";

export class Transform {
	apply(input) {
		throw new Error("Not implemented.");
	}
}

export class TransformMoveWaitAfterLoop extends Transform {
	apply(input) {
		const loop = input.getSymbol("loop");
		if (loop && input.commands[loop.position + 1] instanceof CommandWait) {
			const output = new Track(input.name, input.tickFrequency);
			output.addCommands(input.commands.slice(0, loop.position));
			output.addCommand(input.commands[loop.position + 1]);
			output.addCommand(input.commands[loop.position]);
			output.addCommands(input.commands.slice(loop.position + 2, input.commands.length - 1));
			output.addCommand(input.commands[loop.position + 1]);
			output.addCommand(input.commands[input.commands.length - 1]);
			return output;
		} else {
			return input;
		}
	}
}

export class TransformRemoveWaitsUnder extends Transform {
	constructor(threshold = 0) {
		super();
		this.threshold = threshold;
	}

	apply(input) {
		const output = new Track(input.name, input.tickFrequency);
		let accumulator = 0;
		for (const command of input.commands) {
			if (command instanceof CommandWait) {
				if (command.ticks >= this.threshold) {
					output.addCommand(CommandWait.of(command.ticks + accumulator));
					accumulator = 0;
				} else {
					accumulator += command.ticks;
				}
			} else if (command instanceof CommandLabel || command instanceof CommandJump) {
				if (accumulator > 0) {
					output.addCommand(CommandWait.of(accumulator));
					accumulator = 0;
				}
				output.addCommand(command);
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}
}

export class TransformMapChannels extends Transform {
	constructor(mapping = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]) {
		super();
		this.mapping = mapping;
	}

	apply(input) {
		const output = new Track(input.name, input.tickFrequency);
		for (const command of input.commands) {
			if (command instanceof CommandFMChannel) {
				const newChannel = this.mapping[command.channel];
				if (newChannel < 0) {
					// skip
				} else if (command instanceof CommandFMKey) {
					output.addCommand(CommandFMKey.of(newChannel, command.slots));
				} else if (command instanceof CommandFMFrequency) {
					output.addCommand(CommandFMFrequency.of(newChannel, command.frequency));
				} else if (command instanceof CommandFMInstrument) {
					output.addCommand(CommandFMInstrument.of(newChannel, ...command.parameters));
				}
			} else if (command instanceof CommandOPL4Register && command.address >= 0x208 && command.address < 0x2F8) {
				const newChannel = this.mapping[command.channel];
				if (newChannel >= 0) {
					output.addCommand(CommandOPL4Register.of(command.address - command.channel + newChannel, command.value));
				}
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}
}

export class TransformAttenuateVolume extends Transform {
	constructor(dB = 0) {
		super();
		this.dB = dB;
	}

	apply(input) {
		const output = new Track(input.name, input.tickFrequency);
		for (const command of input.commands) {
			if (command instanceof CommandFMInstrument) {
				output.addCommand(command.attenuateVolume(this.dB));
			} else if (command instanceof CommandOPL4Register && command.address >= 0x250 && command.address < 0x268) {
				const level = command.value >> 1;
				const direct = command.value & 1;
				const newLevel = level == 0x7F ? level : Math.min(Math.max(Math.round(level + this.dB * -8 / 3), 0), 127);
				output.addCommand(CommandOPL4Register.of(command.address, newLevel << 1 | direct));
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}
}

export class TransformFrequencyBeforeKeyOn extends Transform {
	apply(input) {
		const output = new Track(input.name, input.tickFrequency);
		let lastCommand = null;
		for (const command of input.commands) {
			if (command instanceof CommandFMFrequency && lastCommand instanceof CommandFMKey &&
				lastCommand.slots && command.channel == lastCommand.channel) {
				output.commands.pop();
				output.addCommand(command);
				output.addCommand(lastCommand);
			} else {
				output.addCommand(command);
			}
			lastCommand = command;
		}
		return output;
	}
}

export class TransformTrimLeadingSilence extends Transform {
	apply(input) {
		const output = new Track(input.name, input.tickFrequency);
		for (let index = 0; index < input.commands.length; ++index) {
			if (!(input.commands[index] instanceof CommandWait)) {
				output.addCommands(input.commands.slice(index, input.commands.length));
				break;
			}
		}
		return output;
	}
}

export class TransformQuantize extends Transform {
	constructor(tickFrequency = 315000000 / 5256768) {
		super();
		this.tickFrequency = tickFrequency;
	}

	apply(input) {
		const output = new Track(input.name, this.tickFrequency);
		let accumulator = 0;
		for (const command of input.commands) {
			if (command instanceof CommandWait) {
				accumulator += command.ticks * this.tickFrequency;
				if (accumulator >= input.tickFrequency) {
					const newTicks = Math.floor(accumulator / input.tickFrequency);
					output.addCommand(CommandWait.of(newTicks));
					accumulator -= newTicks * input.tickFrequency;
				}
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}
}
