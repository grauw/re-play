import { Register } from "./Chip.ts";
import { ChipOPLL } from "./ChipOPLL.ts";
import { Command, CommandControlFlow, CommandJump, CommandLabel, CommandWait } from "./Command.ts";
import { CommandOPLLConfig, CommandOPLLRegister } from "./CommandOPLL.ts";
import { Track } from "./Track.ts";
import { Transform } from "./Transform.ts";
import { rangeMap } from "./utils.ts";

export class TransformOPLLFrameSanitizer extends Transform {
	apply(input: Track) {
		if (!input.hasSetupCommand(command => command instanceof CommandOPLLConfig))
			return input;
		const output = Track.new(input);
		const emit = (command: Command) => output.addCommand(command);
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

	emitFrame(opllInput: ChipOPLL, opllOutput: ChipOPLL, channelsOff: readonly Register[], rhythmOff: Register, emit: (command: Command) => void) {
		this.emitChannelsOff(opllInput, opllOutput, channelsOff, emit);
		this.emitRhythmOff(opllInput, opllOutput, rhythmOff, emit);
		this.emitUserTone(opllInput, opllOutput, emit);
		this.emitChannels(opllInput, opllOutput, emit);
		this.emitRhythm(opllInput, opllOutput, emit);
	}

	emitChannelsOff(opllInput: ChipOPLL, opllOutput: ChipOPLL, channelsOff: readonly Register[], emit: (command: Command) => void) {
		for (let i = 0; i < 9; i++) {
			writeRegisterIfSet(opllOutput, channelsOff[8 - i], emit);
		}
	}

	emitRhythmOff(opllInput: ChipOPLL, opllOutput: ChipOPLL, rhythmOff: Register, emit: (command: Command) => void) {
		writeRegisterIfSet(opllOutput, rhythmOff, emit);
		rhythmOff.set(opllInput.get(0x0E));
		rhythmOff.unset();
	}

	emitUserTone(opllInput: ChipOPLL, opllOutput: ChipOPLL, emit: (command: Command) => void) {
		for (let i = 0x00; i < 0x08; i++) {
			writeRegisterIfSet(opllOutput, opllInput.getRegister(i), emit);
		}
	}

	emitChannels(opllInput: ChipOPLL, opllOutput: ChipOPLL, emit: (command: Command) => void) {
		for (let i = 0; i < 9; i++) {
			writeRegisterIfSet(opllOutput, opllInput.getRegister(0x38 - i), emit);
			writeRegisterIfSet(opllOutput, opllInput.getRegister(0x18 - i), emit);
			writeRegisterIfSet(opllOutput, opllInput.getRegister(0x28 - i), emit);
		}
	}

	emitRhythm(opllInput: ChipOPLL, opllOutput: ChipOPLL, emit: (command: Command) => void) {
		writeRegisterIfSet(opllOutput, opllInput.getRegister(0x0E), emit);
	}

	unsetLoopChanges(input: Track, opllOutput: ChipOPLL, target: string) {
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

function writeRegisterIfSet(opllOutput: ChipOPLL, register: Register, emit: (command: Command) => void) {
	if (register.isSet()) {
		if (opllOutput.set(register.address, register.value)) {
			emit(CommandOPLLRegister.of(register.address, register.value));
		}
		register.unset();
	}
}

export class TransformOPLLMapChannels extends Transform {
	private readonly mapping: readonly number[];

	constructor(mapping: readonly number[] = []) {
		super();
		this.mapping = mapping;
	}

	apply(input: Track) {
		if (this.mapping.every((value, index) => value == index))
			return input;
		const output = Track.new(input);
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

export class TransformOPLLAttenuateVolume extends Transform {
	private readonly dB: number;

	constructor(dB = 0) {
		super();
		this.dB = dB;
	}

	apply(input: Track) {
		if (this.dB == 0)
			return input;
		const output = Track.new(input);
		for (const command of input.commands) {
			if (command instanceof CommandOPLLRegister && command.address >= 0x30 && command.address < 0x40) {
				const level = command.value & 0x0F;
				const instrument = command.value >> 4;
				const newLevel = Math.min(Math.max(Math.round(level + this.dB / -3), 0x00), 0x0F);
				output.addCommand(CommandOPLLRegister.of(command.address, instrument << 4 | newLevel));
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}
}
