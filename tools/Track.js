import { CommandLabel, CommandJump, CommandCall, CommandReturn, CommandWait, Command } from "./Command.js";
import { CommandFMInstrument } from "./CommandFM.js";

export class Track {
	constructor(name, tickFrequency) {
		this.name = name;
		this.tickFrequency = tickFrequency;
		this.commands = [];
	}

	addCommand(command) {
		if (command instanceof CommandWait && this.commands.at(-1) instanceof CommandWait) {
			command = command.add(this.commands.pop());
		} else if (command instanceof CommandLabel) {
			if (this.commands.at(-1) instanceof CommandJump && this.commands.at(-1).target == command.name) {
				this.commands.pop();
			}
		} else if (command instanceof CommandFMInstrument) {
			let tail = [];
			while (this.commands.at(-1) instanceof CommandFMInstrument) {
				const lastCommand = this.commands.pop();
				if (lastCommand.channel == command.channel) {
					break;
				} else {
					tail.push(lastCommand);
				}
			}
			while (tail.length > 0) {
				this.commands.push(tail.pop());
			}
		} else if (command instanceof CommandReturn) {
			if (this.commands.at(-1) instanceof CommandCall) {
				command = CommandJump.of(this.commands.pop().target);
			}
		} else if (!(command instanceof Command)) {
			throw new Error("Not a command.");
		}
		this.commands.push(command);
	}

	addCommands(commands) {
		for (const command of commands)
			this.addCommand(command);
	}

	hasSetupCommand(predicate) {
		return this.getSetupCommand(predicate) != null;
	}

	getSetupCommand(predicate) {
		for (const command of this.commands) {
			if (command instanceof CommandWait) {
				return null;
			} else if (predicate(command)) {
				return command;
			}
		}
		return null;
	}

	static new(track) {
		return new Track(track.name, track.tickFrequency);
	}

	static ofTracksWithIndex(name, tracks) {
		const tickFrequency = tracks.length / tracks.reduce((sum, track) => sum + 1 / track.tickFrequency, 0);
		const track = new Track(name, tickFrequency);
		for (let i = 0; i < tracks.length; i++) {
			track.addCommand(CommandJump.of(tracks[i].name));
		}

		for (const track_ of tracks) {
			track.addCommands(track_.addScope(track_.name).commands);
		}
		return track;
	}

	addScope(name) {
		const track = Track.new({...this, name});
		track.addCommand(CommandLabel.of(name));
		for (const command of this.commands) {
			if (command instanceof CommandLabel) {
				track.addCommand(CommandLabel.of(`${name}.${command.name}`));
			} else if (command instanceof CommandJump) {
				track.addCommand(CommandJump.of(`${name}.${command.target}`));
			} else if (command instanceof CommandCall) {
				track.addCommand(CommandCall.of(`${name}.${command.target}`));
			} else {
				track.addCommand(command);
			}
		}
		return track;
	}

	isLoopLabel(command) {
		return command instanceof CommandLabel && this.commands.at(-1) instanceof CommandJump &&
			command.name == this.commands.at(-1).target;
	}
}
