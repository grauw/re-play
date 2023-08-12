import { Transform } from "./Transform.js";
import { Track } from "./Track.js";
import { CommandWait, CommandControlFlow, CommandLabel, CommandJump } from "./Command.js";
import { CommandOPLLConfig, CommandOPLLRegister } from "./CommandOPLL.js";
import { ChipOPLL } from "./ChipOPLL.js";
import { Register } from "./Chip.js";
import { rangeMap } from "./utils.js";

export class TransformOPLLFrameSanitizer extends Transform {
	apply(input) {
		if (!input.hasSetupCommand(command => command instanceof CommandOPLLConfig))
			return input;
		const output = new Track(input.name, input.tickFrequency);
		const emit = command => output.addCommand(command);
		const opllInput = new ChipOPLL();
		const opllOutput = new ChipOPLL();
		const channelsOff = rangeMap(9, channel => new Register(0x20 + channel));
		const rhythmOff = new Register(0x0E);
		for (const command of input.commands) {
			if (command instanceof CommandOPLLRegister) {
				if (command.address >= 0x20 && command.address < 0x29 && (command.value & 0x10) == 0) {
					channelsOff[command.address & 0x0F].set(command.value);
				} else if (command.address == 0x0E) {
					const offBits = ~command.value & rhythmOff.get(0x1F) & 0x1F;
					rhythmOff.set(0, offBits);
				}
				opllInput.writeCommand(command);
			} else if (command instanceof CommandOPLLConfig) {
				opllInput.writeCommand(command);
				opllOutput.writeCommand(command);
				output.addCommand(command);
			} else if (command instanceof CommandWait || command instanceof CommandControlFlow) {
				this.emitFrame(opllInput, opllOutput, channelsOff, rhythmOff, emit);
				if (command instanceof CommandLabel && input.isLoopLabel(command)) {
					this.unsetLoopChanges(input, opllOutput, command.name);
				}
				output.addCommand(command);
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}

	emitFrame(opllInput, opllOutput, channelsOff, rhythmOff, emit) {
		this.emitChannelsOff(opllInput, opllOutput, channelsOff, emit);
		this.emitRhythmOff(opllInput, opllOutput, rhythmOff, emit);
		this.emitUserTone(opllInput, opllOutput, emit);
		this.emitChannels(opllInput, opllOutput, emit);
		this.emitRhythm(opllInput, opllOutput, emit);
	}

	emitChannelsOff(opllInput, opllOutput, channelsOff, emit) {
		for (let i = 0; i < 9; i++) {
			writeRegisterIfSet(opllOutput, channelsOff[8 - i], emit);
		}
	}

	emitRhythmOff(opllInput, opllOutput, rhythmOff, emit) {
		writeRegisterIfSet(opllOutput, rhythmOff, emit);
		rhythmOff.set(opllInput.get(0x0E));
		rhythmOff.unset();
	}

	emitUserTone(opllInput, opllOutput, emit) {
		for (let i = 0x00; i < 0x08; i++) {
			writeRegisterIfSet(opllOutput, opllInput.getRegister(i), emit);
		}
	}

	emitChannels(opllInput, opllOutput, emit) {
		for (let i = 0; i < 9; i++) {
			writeRegisterIfSet(opllOutput, opllInput.getRegister(0x38 - i), emit);
			writeRegisterIfSet(opllOutput, opllInput.getRegister(0x18 - i), emit);
			writeRegisterIfSet(opllOutput, opllInput.getRegister(0x28 - i), emit);
		}
	}

	emitRhythm(opllInput, opllOutput, emit) {
		writeRegisterIfSet(opllOutput, opllInput.getRegister(0x0E), emit);
	}

	unsetLoopChanges(input, opllOutput, target) {
		const opllLoop = new ChipOPLL();
		for (const command of input.commands) {
			opllLoop.writeCommand(command);
			if (command instanceof CommandJump && command.target == target) {
				break;
			}
		}
		for (let address = 0x00; address < 0x40; address++) {
			if (!opllOutput.getRegister(address).equals(opllLoop.getRegister(address))) {
				opllOutput.unset(address);
			}
		}
	}
}

function writeRegisterIfSet(opllOutput, register, emit) {
	if (register.isSet()) {
		if (opllOutput.set(register.address, register.value)) {
			emit(CommandOPLLRegister.of(register.address, register.value));
		}
		register.unset();
	}
}

export class TransformOPLLMapChannels extends Transform {
	constructor(mapping = []) {
		super();
		this.mapping = mapping;
	}

	apply(input) {
		if (this.mapping.every((value, index) => value == index))
			return input;
		const output = new Track(input.name, input.tickFrequency);
		for (const command of input.commands) {
			if (command instanceof CommandOPLLRegister && command.address >= 0x10 && command.address < 0x40) {
				const channel = command.address & 0x0F;
				const newChannel = this.mapping[channel] ?? channel;
				if (newChannel >= 0) {
					output.addCommand(CommandOPLLRegister.of(command.address - channel + newChannel, command.value));
				}
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}
}
