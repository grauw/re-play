import { Transform } from "./Transform.js";
import { Track } from "./Track.js";
import { CommandLabel } from "./Command.js";
import { CommandOPNConfig, CommandOPNRegister, CommandFMKey, CommandFMFrequency } from "./CommandFM.js";
import { ChipOPN } from "./ChipOPN.js";

export class TransformOPNToGenericFM extends Transform {
	apply(input) {
		if (!(input.commands[0] instanceof CommandOPNConfig))
			return input;
		const output = new Track(input.name, input.tickFrequency);
		const opn = new ChipOPN();
		for (const command of input.commands) {
			if (command instanceof CommandOPNRegister) {
				opn.writeRegister(command.address, command.value, command => output.addCommand(command));
				continue;
			} else if (command instanceof CommandOPNConfig) {
				opn.writeCommand(command);
			} else if (command instanceof CommandLabel && command.name == "loop") {
				opn.unsetAll(~0);
			}
			output.addCommand(command);
		}
		return output;
	}
}

export class TransformOPNFrequencyBeforeKeyOn extends Transform {
	apply(input) {
		if (!(input.commands[0] instanceof CommandOPNConfig))
			return input;
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
