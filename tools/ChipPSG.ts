import { Chip } from "./Chip.ts";
import type { Command } from "./Command.ts";
import { CommandPSGConfig, CommandPSGRegister } from "./CommandPSG.ts";

export class ChipPSG extends Chip {
	private clockFrequency: number;

	constructor() {
		super(registerMasks);
		this.clockFrequency = 1789773;
		this.getRegister(0x07).value = 0x80;
	}

	config(clockFrequency: number) {
		this.clockFrequency = clockFrequency;
	}

	writeCommand(command: Command) {
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
