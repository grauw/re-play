import { Command, CommandCall, CommandJump, CommandLabel, CommandReturn, CommandWait } from "./Command.ts";
import type { Track } from "./Track.ts";

export class Player {
	private readonly track: Track;
	public readonly indexCount: number;
	public playing: boolean;
	private wait: number;
	public stack: number[];
	private path: (CommandLabel | CommandCall)[];
	private readonly stackCapacity: number;
	private readonly symbols: Map<string, number>;

	constructor(track: Track, stackCapacity = 128) {
		this.track = track;
		this.indexCount = Math.max(1, track.getIndex().length);
		this.playing = false;
		this.wait = 1;
		this.stack = [];
		this.path = [];
		this.stackCapacity = stackCapacity;
		this.symbols = new Map();
		for (let index = 0; index < track.commands.length; index++) {
			const command = track.commands[index];
			if (command instanceof CommandLabel) {
				if (this.symbols.has(command.name)) {
					throw new Error(`Symbol already exists: ${command.name}`);
				}
				this.symbols.set(command.name, index);
			}
		}
	}

	play(index: number) {
		this.stack = [index];
		this.path = [];
		this.wait = 1;
		this.playing = true;
	}

	resume() {
		this.playing = true;
	}

	stop() {
		this.playing = false;
	}

	run(process = (command: Command, index: number) => { this.process(command, index); }) {
		while (this.tick(process)) {};
	}

	private tick(process = (command: Command, index: number) => { this.process(command, index); }) {
		if (this.playing) {
			this.wait--;
			if (this.wait == 0) {
				let index = this.pop();
				while (true) {
					const command = this.getCommand(index);
					process(command, index);
					index++;

					if (command instanceof CommandJump) {
						index = this.getSymbol(command.target);
					} else if (command instanceof CommandCall) {
						this.push(index);
						index = this.getSymbol(command.target);
					} else if (command instanceof CommandReturn) {
						index = this.pop();
					} else if (command instanceof CommandWait) {
						this.wait = command.ticks;
						break;
					}
				}
				this.push(index);
			}
		}
		return this.playing;
	}

	getCommand(index: number) {
		if (index >= 0 && index < this.track.commands.length) {
			return this.track.commands[index];
		} else {
			throw new Error("Command index out of bounds.");
		}
	}

	private getSymbol(name: string) {
		const symbol = this.symbols.get(name);
		if (symbol == undefined) {
			throw new Error(`Symbol not found: ${name}`);
		}
		return symbol;
	}

	private push(index: number) {
		this.stack.push(index);
		if (this.stack.length > this.stackCapacity) {
			throw new Error("Stack over capacity.");
		}
	}

	private pop() {
		const index = this.stack.pop();
		if (index == undefined) {
			throw new Error("Stack empty.");
		}
		return index;
	}

	public process(command: Command, index: number) {
		if (command instanceof CommandLabel || command instanceof CommandCall) {
			this.path.push(command);
		} else if (command instanceof CommandReturn) {
			while (this.path.at(-1) instanceof CommandLabel) {
				this.path.pop();
			}
			if (this.path.at(-1) instanceof CommandCall) {
				this.path.pop();
			} else {
				throw new Error("Return without call.");
			}
		} else if (command instanceof CommandJump) {
			for (let i = this.path.length - 1; i >= 0; i--) {
				const pathCommand = this.path[i];
				if (pathCommand instanceof CommandLabel) {
					if (pathCommand.name == command.target) {  // loop
						return true;
					}
				} else {
					break;
				}
			}
		}
		return false;
	}
}
