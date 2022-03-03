import { Transform } from "./Transform.js";
import { Track } from "./Track.js";
import { CommandFMKey, CommandFMFrequency } from "./CommandFM.js";

export class TransformOPNFrequencyBeforeKeyOn extends Transform {
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
