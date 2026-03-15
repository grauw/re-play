import type { Register } from "./Chip.ts";
import { ChipPSG } from "./ChipPSG.ts";
import { Command, CommandControlFlow, CommandJump, CommandLabel, CommandWait } from "./Command.ts";
import { CommandPSGConfig, CommandPSGRegister } from "./CommandPSG.ts";
import { Track } from "./Track.ts";
import { Transform, TransformSetup } from "./Transform.ts";

export class TransformPSGSetup extends TransformSetup {
	protected isConfig(command: Command) {
		return command instanceof CommandPSGConfig;
	}

	protected createCommand(address: number, value: number) {
		return CommandPSGRegister.of(address, value);
	}
}

export class TransformPSGFrameSanitizer extends Transform {
	apply(input: Track) {
		if (!input.hasSetupCommand(command => command instanceof CommandPSGConfig))
			return input;
		const output = Track.new(input);
		const emit = (command: Command) => output.addCommand(command);
		const psgInput = new ChipPSG();
		const psgOutput = new ChipPSG();
		for (const command of input.commands) {
			if (command instanceof CommandPSGRegister) {
				psgInput.writeCommand(command);
			} else if (command instanceof CommandPSGConfig) {
				psgInput.writeCommand(command);
				psgOutput.writeCommand(command);
				output.addCommand(command);
			} else if (command instanceof CommandWait || command instanceof CommandControlFlow) {
				this.emitFrame(psgInput, psgOutput, emit);
				if (command instanceof CommandLabel && input.isLoopLabel(command)) {
					this.unsetLoopChanges(input, psgOutput, command.name);
				}
				output.addCommand(command);
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}

	emitFrame(psgInput: ChipPSG, psgOutput: ChipPSG, emit: (command: Command) => void) {
		this.emitEnvelope(psgInput, psgOutput, emit);
		this.emitNoise(psgInput, psgOutput, emit);
		for (let channel = 0; channel < 3; channel++) {
			this.emitToneLevel(psgInput, psgOutput, channel, emit);
		}
		this.emitMixer(psgInput, psgOutput, emit);
	}

	emitEnvelope(psgInput: ChipPSG, psgOutput: ChipPSG, emit: (command: Command) => void) {
		for (let i = 0x0B; i < 0x0E; i++) {
			writeRegisterIfSet(psgOutput, psgInput.getRegister(i), emit);
		}
	}

	emitNoise(psgInput: ChipPSG, psgOutput: ChipPSG, emit: (command: Command) => void) {
		if (psgInput.get(0x07, 0x38) != 0x38) {
			writeRegisterIfSet(psgOutput, psgInput.getRegister(0x06), emit);
		}
	}

	emitToneLevel(psgInput: ChipPSG, psgOutput: ChipPSG, channel: number, emit: (command: Command) => void) {
		if (psgInput.get(0x07, 1 << channel) == 0 && psgInput.get(0x08 + channel) != 0) {
			writeRegisterIfSet(psgOutput, psgInput.getRegister(0x00 + channel * 2), emit);
			writeRegisterIfSet(psgOutput, psgInput.getRegister(0x01 + channel * 2), emit);
		}
		writeRegisterIfSet(psgOutput, psgInput.getRegister(0x08 + channel), emit);
	}

	emitMixer(psgInput: ChipPSG, psgOutput: ChipPSG, emit: (command: Command) => void) {
		writeRegisterIfSet(psgOutput, psgInput.getRegister(0x07), emit);
	}

	unsetLoopChanges(input: Track, psgOutput: ChipPSG, target: string) {
		const psgLoop = new ChipPSG();
		for (const command of input.commands) {
			psgLoop.writeCommand(command);
			if (command instanceof CommandJump && command.target == target) {
				break;
			}
		}
		for (let address = 0x00; address < 0x10; address++) {
			if (!psgOutput.getRegister(address).equals(psgLoop.getRegister(address))) {
				psgOutput.unset(address);
			}
		}
	}
}

function writeRegisterIfSet(psgOutput: ChipPSG, register: Register, emit: (command: Command) => void) {
	if (register.isSet()) {
		if (psgOutput.set(register.address, register.value)) {
			emit(CommandPSGRegister.of(register.address, register.value));
		}
		register.unset();
	}
}

export class TransformPSGMapChannels extends Transform {
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
			if (command instanceof CommandPSGRegister && command.address >= 0x00 && command.address < 0x06) {
				const channel = command.address >> 1;
				const newChannel = this.mapping[channel] ?? channel;
				if (newChannel >= 0 && newChannel < 3) {
					output.addCommand(CommandPSGRegister.of(command.address - channel * 2 + newChannel * 2, command.value));
				}
			} else if (command instanceof CommandPSGRegister && command.address == 0x07) {
				const io = command.value & 0xC0;
				const mixer = [command.value & 0x09, command.value >> 1 & 0x09, command.value >> 2 & 0x09];
				const newMixer = [0x09, 0x09, 0x09];
				for (let channel = 0; channel < 3; channel++) {
					const newChannel = this.mapping[channel] ?? channel;
					if (newChannel >= 0) {
						newMixer[newChannel] = mixer[channel];
					}
				}
				output.addCommand(CommandPSGRegister.of(command.address, io | newMixer[2] << 2 | newMixer[1] << 1 | newMixer[0]));
			} else if (command instanceof CommandPSGRegister && command.address >= 0x08 && command.address < 0x0B) {
				const channel = command.address - 0x08;
				const newChannel = this.mapping[channel] ?? channel;
				if (newChannel >= 0 && newChannel < 3) {
					output.addCommand(CommandPSGRegister.of(command.address - channel + newChannel, command.value));
				}
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}
}

export class TransformPSGAttenuateVolume extends Transform {
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
			if (command instanceof CommandPSGRegister && command.address >= 0x08 && command.address < 0x0B) {
				const level = command.value & 0x0F;
				const envelopeEnable = command.value >> 4 & 0x01;
				const newLevel = level == 0x00 ? level : Math.min(Math.max(Math.round(level + this.dB / 3), 0x00), 0x0F);
				output.addCommand(CommandPSGRegister.of(command.address, envelopeEnable << 4 | newLevel));
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}
}
