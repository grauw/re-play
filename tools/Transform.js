import { Track } from "./Track.js";
import { CommandWait, CommandLabel, CommandJump, CommandReturn, CommandGD3 } from "./Command.js";
import { CommandOPNConfig, CommandFMInstrument } from "./CommandFM.js";
import { CommandOPL4Config, CommandOPL4Register, CommandOPL4WaveMemory } from "./CommandOPL4.js";
import { CommandOPLLConfig, CommandOPLLRegister } from "./CommandOPLL.js";
import { CommandPSGConfig, CommandPSGRegister } from "./CommandPSG.js";

export class Transform {
	apply(input) {
		return input;
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
			} else if (command instanceof CommandOPLLRegister && command.address >= 0x30 && command.address < 0x40) {
				const level = command.value & 0x0F;
				const instrument = command.value >> 4;
				const newLevel = Math.min(Math.max(Math.round(level + this.dB / -3), 0), 15);
				output.addCommand(CommandOPLLRegister.of(command.address, instrument << 4 | newLevel));
			} else if (command instanceof CommandPSGRegister && command.address >= 0x08 && command.address < 0x0B) {
				const level = command.value & 0x0F;
				const envelopeEnable = command.value >> 4 & 0x01;
				const newLevel = level == 0x00 ? level : Math.min(Math.max(Math.round(level + this.dB / 3), 0), 15);
				output.addCommand(CommandPSGRegister.of(command.address, envelopeEnable << 4 | newLevel));
			} else {
				output.addCommand(command);
			}
		}
		return output;
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

export class TransformQuantize extends Transform {
	constructor(tickFrequency = 44100, waitThreshold = 0, tolerance = 0) {
		super();
		if (tolerance < 0 || tolerance > 0.5)
			throw new Error("Tolerance must not exceed 0.5.");
		this.tickFrequency = tickFrequency;
		this.waitThreshold = waitThreshold;
		this.tolerance = tolerance;
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
		let inputTicks = 0;
		let outputTicks = 0;
		let accumulator = 0;
		let resetNextAccumulator = this.tolerance != 0;
		for (const command of input.commands) {
			if (command instanceof CommandWait) {
				accumulator += command.ticks * this.tickFrequency;
				if (command.ticks >= this.waitThreshold) {
					const ticks = Math.floor((accumulator + this.tolerance * input.tickFrequency) / input.tickFrequency);
					if (ticks >= 1) {
						accumulator -= ticks * input.tickFrequency;
						if (resetNextAccumulator) {
							outputTicks += accumulator / input.tickFrequency;
							accumulator = 0;
							resetNextAccumulator = false;
						}
						if (this.tolerance) {
							if (accumulator >= this.tolerance * input.tickFrequency) {
								const remainingTicks = accumulator / input.tickFrequency;
								const deviation = remainingTicks < 0.5 ? remainingTicks : remainingTicks - 1;
								throw new Error(`Tolerance exceeded in track ${input.name} at tick ${inputTicks}: ${deviation}`);
							}
							accumulator *= (1 - this.tolerance) ** ticks;
						}
						output.addCommand(CommandWait.of(ticks));
						outputTicks += ticks;
					}
				}
				inputTicks += command.ticks;
			} else {
				output.addCommand(command);
			}
		}
		outputTicks += accumulator / input.tickFrequency;
		if (this.tolerance) {
			output.tickFrequency = input.tickFrequency * outputTicks / inputTicks;
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

export class TransformStartConfigAndWait extends Transform {
	apply(input) {
		const output = new Track(input.name, input.tickFrequency);
		for (let index = 0; index < input.commands.length; ++index) {
			const command = input.commands[index];
			if (command instanceof CommandWait) {
				// skip
			} else if (command instanceof CommandGD3 || command instanceof CommandOPNConfig ||
				command instanceof CommandOPL4Config || command instanceof CommandOPL4WaveMemory ||
				(command instanceof CommandOPL4Register && command.address == 0x0BD) ||
				(command instanceof CommandOPL4Register && command.address == 0x104) ||
				(command instanceof CommandOPL4Register && command.address == 0x105) ||
				(command instanceof CommandOPL4Register && command.address == 0x202) ||
				command instanceof CommandOPLLConfig || command instanceof CommandPSGConfig) {
				output.addCommand(command);
			} else {
				output.addCommand(CommandWait.of(1));
				output.addCommands(input.commands.slice(index, input.commands.length));
				break;
			}
		}
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
