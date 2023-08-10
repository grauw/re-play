import { Transform } from "./Transform.js";
import { Track } from "./Track.js";
import { CommandWait, CommandControlFlow, CommandLabel, CommandJump } from "./Command.js";
import { CommandPSGConfig, CommandPSGRegister } from "./CommandPSG.js";
import { ChipPSG } from "./ChipPSG.js";

export class TransformPSGFrameSanitizer extends Transform {
	apply(input) {
		if (!input.hasSetupCommand(command => command instanceof CommandPSGConfig))
			return input;
		const output = new Track(input.name, input.tickFrequency);
		const emit = command => output.addCommand(command);
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

	emitFrame(psgInput, psgOutput, emit) {
		this.emitEnvelope(psgInput, psgOutput, emit);
		this.emitNoise(psgInput, psgOutput, emit);
		for (let channel = 0; channel < 3; channel++) {
			this.emitToneLevel(psgInput, psgOutput, channel, emit);
		}
		this.emitMixer(psgInput, psgOutput, emit);
	}

	emitEnvelope(psgInput, psgOutput, emit) {
		if (psgInput.isSet(0x0D)) {
			psgOutput.unset(0x0D);  // envelope shape register has retrigger side effect
		}
		for (let i = 0x0B; i < 0x0E; i++) {
			writeRegisterIfSet(psgOutput, psgInput.getRegister(i), emit);
		}
	}

	emitNoise(psgInput, psgOutput, emit) {
		if (psgInput.get(0x07, 0x38) != 0x38) {
			writeRegisterIfSet(psgOutput, psgInput.getRegister(0x06), emit);
		}
	}

	emitToneLevel(psgInput, psgOutput, channel, emit) {
		if (psgInput.get(0x07, 1 << channel) == 0 && psgInput.get(0x08 + channel) != 0) {
			writeRegisterIfSet(psgOutput, psgInput.getRegister(0x00 + channel * 2), emit);
			writeRegisterIfSet(psgOutput, psgInput.getRegister(0x01 + channel * 2), emit);
		}
		writeRegisterIfSet(psgOutput, psgInput.getRegister(0x08 + channel), emit);
	}

	emitMixer(psgInput, psgOutput, emit) {
		writeRegisterIfSet(psgOutput, psgInput.getRegister(0x07), emit);
	}

	unsetLoopChanges(input, psgOutput, target) {
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

function writeRegisterIfSet(psgOutput, register, emit) {
	if (register.isSet()) {
		if (psgOutput.set(register.address, register.value)) {
			emit(CommandPSGRegister.of(register.address, register.value));
		}
		register.unset();
	}
}
