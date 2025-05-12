import { CommandLabel, CommandJump, CommandCall, CommandReturn, CommandWait, Command } from "./Command.js";
import { CommandFMInstrument } from "./CommandFM.js";
import { Grammar } from "lfs2-compression";

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

	getIndex() {
		const index = [];
		for (const command of this.commands) {
			if (command instanceof CommandJump) {
				index.push(command.target);
			} else if (command instanceof CommandLabel) {
				if (!index.includes(command.name)) {
					index.push(command.name);
				}
				break;
			} else {
				break;
			}
		}
		return index;
	}

	getCommandsGrammar(startSymbol) {
		const rules = new Map();
		let nonTerminal = startSymbol;
		let expansion = [];
		let lastCommand = undefined;
		for (const command of this.commands) {
			if (command instanceof CommandLabel) {
				if (!(lastCommand instanceof CommandJump || lastCommand instanceof CommandReturn)) {
					expansion.push(Symbol.for(command.name));
				}
				rules.set(nonTerminal, expansion);
				nonTerminal = Symbol.for(command.name);
				expansion = [];
			} else if (command instanceof CommandJump) {
				expansion.push(Symbol.for(command.target));
			} else if (command instanceof CommandCall) {
				expansion.push(Symbol.for(command.target));
			} else if (command instanceof CommandReturn) {
			} else {
				expansion.push(command);
			}
			lastCommand = command;
		}
		rules.set(nonTerminal, expansion);
		return new Grammar(rules);
	}

	addCommandsGrammar(grammar, startSymbol) {
		const symbolToLabel = symbol => Symbol.keyFor(symbol) ?? `.${symbol.description}`;
		const loopingRules = grammar.getRecursiveRules(startSymbol);
		for (const [nonTerminal, expansion] of grammar) {
			if (nonTerminal != startSymbol) {
				this.addCommand(CommandLabel.of(symbolToLabel(nonTerminal)));
			} else if (this.commands.length > 0) {
				throw new Error("Start symbol is not the first rule.");
			}
			for (let i = 0; i < expansion.length; i++) {
				const command = expansion[i];
				if (typeof command == "symbol") {
					if (loopingRules.has(command)) {
						this.addCommand(CommandJump.of(symbolToLabel(command)));
					} else {
						this.addCommand(CommandCall.of(symbolToLabel(command)));
					}
				} else {
					this.addCommand(command);
				}
			}
			if (!(this.commands.at(-1) instanceof CommandJump)) {
				this.addCommand(CommandReturn.of());
			}
		}
	}
}
