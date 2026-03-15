import { Command } from "./Command.ts";
import { CommandFMChannel, CommandFMFrequency, CommandFMInstrument, CommandFMKey } from "./CommandFM.ts";
import { CommandOPNConfig } from "./CommandOPN.ts";
import { Track } from "./Track.ts";
import { Transform } from "./Transform.ts";

export class TransformFMFrequencyBeforeKeyOn extends Transform {
	apply(input: Track) {
		if (!input.hasSetupCommand(command => command instanceof CommandOPNConfig))
			return input;
		const output = Track.new(input);
		let lastCommand: Command | undefined;
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

export class TransformFMMapChannels extends Transform {
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
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}
}

export class TransformFMAttenuateVolume extends Transform {
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
			if (command instanceof CommandFMInstrument) {
				output.addCommand(command.attenuateVolume(this.dB));
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}
}
