import { Track } from "./Track.js";
import { CommandWait, CommandControlFlow, CommandLabel, CommandJump, CommandReturn } from "./Command.js";
import { CommandOPNConfig, CommandFMChannel, CommandFMKey, CommandFMFrequency, CommandFMInstrument } from "./CommandFM.js";
import { CommandOPL4Config, CommandOPL4Register, CommandOPL4WaveMemory } from "./CommandOPL4.js";

export class Transform {
	apply(input) {
		throw new Error("Not implemented.");
	}
}

export class TransformMoveWaitAfterLoop extends Transform {
	apply(input) {
		if (input.commands.at(-1) instanceof CommandJump) {
			const loop = input.commands.findIndex(command => command instanceof CommandLabel && input.isLoopLabel(command));
			if (loop >= 0 && input.commands[loop + 1] instanceof CommandWait) {
				const output = new Track(input.name, input.tickFrequency);
				output.addCommands(input.commands.slice(0, loop));
				output.addCommand(input.commands[loop + 1]);
				output.addCommand(input.commands[loop]);
				output.addCommands(input.commands.slice(loop + 2, input.commands.length - 1));
				output.addCommand(input.commands[loop + 1]);
				output.addCommand(input.commands[input.commands.length - 1]);
				return output;
			}
		}
		return input;
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
			} else if (command instanceof CommandControlFlow) {
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
	constructor(mapping = []) {
		super();
		this.mapping = mapping;
	}

	apply(input) {
		const output = new Track(input.name, input.tickFrequency);
		for (const command of input.commands) {
			if (command instanceof CommandFMChannel) {
				const newChannel = this.mapping[command.channel] ?? command.channel;
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
				const newChannel = this.mapping[command.waveChannel] ?? command.waveChannel;
				if (newChannel >= 0) {
					output.addCommand(CommandOPL4Register.of(command.address - command.waveChannel + newChannel, command.value));
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

export class TransformTrimLeadingSilence extends Transform {
	apply(input) {
		const output = new Track(input.name, input.tickFrequency);
		for (let index = 0; index < input.commands.length; ++index) {
			const command = input.commands[index];
			if (command instanceof CommandWait) {
				// skip
			} else if (command instanceof CommandOPNConfig ||
				command instanceof CommandOPL4Config || command instanceof CommandOPL4WaveMemory ||
				(command instanceof CommandOPL4Register && command.address == 0x202)) {
				output.addCommand(command);
			} else {
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
		if (this.tickFrequency == "opl4-timer") {
			return this.applyOPL4Timer(input);
		} else {
			return this.applyHertz(input);
		}
	}

	applyHertz(input) {
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

	applyOPL4Timer(input) {
		let inputTicks = 0;
		let outputTicks = 0;
		let timerActive = false;
		const output = new Track(input.name, 0);
		for (const command of input.commands) {
			if (command instanceof CommandWait) {
				if (timerActive) {
					inputTicks += command.ticks;
				}
			} else if (command instanceof CommandOPL4Register && command.address == 0x004) {
				if (command.value & 0x80) {
					output.addCommand(CommandWait.of(1));
					outputTicks++;
				} else {
					timerActive = (command.value & 0x03) != 0;
				}
			} else {
				output.addCommand(command);
			}
		}
		if (inputTicks == 0) {
			throw new Error(`No timer active in track ${input.name}.`);
		}
		output.tickFrequency = input.tickFrequency * outputTicks / inputTicks;
		return output;
	}
}

export class TransformEndLoop extends Transform {
	apply(input) {
		if (input.commands.at(-1) instanceof CommandReturn) {
			const output = new Track(input.name, input.tickFrequency);
			const stripCount = input.commands.at(-2) instanceof CommandWait ? 2 : 1;
			output.addCommands(input.commands.slice(0, -stripCount));
			output.addCommand(CommandLabel.of("loop"));
			output.addCommand(CommandWait.of(1));
			output.addCommand(CommandJump.of("loop"));
			return output;
		} else {
			return input;
		}
	}
}
