import { CommandLabel, CommandJump, CommandCall, CommandReturn, CommandWait } from "./Command.js";

export class Player {
	constructor(track, stackCapacity = 128) {
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

	play(index) {
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

	run(process = (command, index) => this.process(command, index)) {
		while (this.tick(process)) {};
	}

	tick(process = (command, index) => this.process(command, index)) {
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

	getCommand(index) {
		if (index >= 0 && index < this.track.commands.length) {
			return this.track.commands[index];
		} else {
			throw new Error("Command index out of bounds.");
		}
	}

	getSymbol(name) {
		if (this.symbols.has(name)) {
			return this.symbols.get(name);
		} else {
			throw new Error(`Symbol not found: ${name}`);
		}
	}

	push(index) {
		this.stack.push(index);
		if (this.stack.length > this.stackCapacity) {
			throw new Error("Stack over capacity.");
		}
	}

	pop() {
		if (this.stack.length > 0) {
			return this.stack.pop();
		} else {
			throw new Error("Stack empty.");
		}
	}

	process(command, index) {
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
				if (this.path[i] instanceof CommandLabel) {
					if (this.path[i].name == command.target) {  // loop
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
