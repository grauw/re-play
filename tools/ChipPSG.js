import { Chip } from "./Chip.js";
import { CommandPSGConfig, CommandPSGRegister } from "./CommandPSG.js";

export class ChipPSG extends Chip {
	constructor() {
		super(registerMasks);
		this.clockFrequency = 1789773;
		this.getRegister(0x07).value = 0x80;
	}

	config(clockFrequency) {
		this.clockFrequency = clockFrequency;
	}

	writeCommand(command) {
		if (command instanceof CommandPSGRegister) {
			this.set(command.address, command.value);
		} else if (command instanceof CommandPSGConfig) {
			this.config(command.clockFrequency);
		}
	}
}

const registerMasks = [
	0xFF, 0x0F, 0xFF, 0x0F, 0xFF, 0x0F, 0x1F, 0x3F, 0x1F, 0x1F, 0x1F, 0xFF, 0xFF, 0x0F, 0x00, 0x00,
];
