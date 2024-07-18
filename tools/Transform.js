import { Track } from "./Track.js";
import { CommandWait, CommandLabel, CommandJump, CommandCall, CommandReturn, CommandGD3 } from "./Command.js";
import { CommandOPNConfig } from "./CommandFM.js";
import { CommandOPL4Config, CommandOPL4Register, CommandOPL4WaveMemory } from "./CommandOPL4.js";
import { CommandOPLLConfig } from "./CommandOPLL.js";
import { CommandPSGConfig } from "./CommandPSG.js";
import { Grammar } from "lfs2-compression";
import { Player } from "./Player.js";

export class Transform {
	apply(input) {
		return input;
	}
}

export class TransformGroup {
	constructor(transforms = []) {
		this.transforms = transforms;
	}

	apply(input) {
		return this.transforms.reduce((input, transform) => transform.apply(input), input);
	}
}

export class TransformMoveWaitAfterLoop extends Transform {
	apply(input) {
		if (input.commands.at(-1) instanceof CommandJump) {
			const loop = input.commands.findIndex(command => command instanceof CommandLabel && input.isLoopLabel(command));
			if (loop >= 0 && input.commands[loop + 1] instanceof CommandWait) {
				const output = Track.new(input);
				output.addCommands(input.commands.slice(0, loop));
				output.addCommand(input.commands[loop + 1]);
				output.addCommand(input.commands[loop]);
				output.addCommands(input.commands.slice(loop + 2, input.commands.length - 1));
				output.addCommand(input.commands[loop + 1]);
				output.addCommand(input.commands[input.commands.length - 1]);
				return output;
			}
		}
		return input;
	}
}

export class TransformQuantize extends Transform {
	constructor(tickFrequency = 44100, waitThreshold = 0, tolerance = 0) {
		super();
		if (tolerance < 0 || tolerance > 0.5)
			throw new Error("Tolerance must not exceed 0.5.");
		this.tickFrequency = tickFrequency;
		this.waitThreshold = waitThreshold;
		this.tolerance = tolerance;
	}

	apply(input) {
		if (this.tickFrequency == "opl4-timer") {
			return this.applyOPL4Timer(input);
		} else {
			return this.applyHertz(input);
		}
	}

	applyHertz(input) {
		const output = Track.new({...input, tickFrequency: this.tickFrequency});
		let inputTicks = 0;
		let outputTicks = 0;
		let accumulator = 0;
		let resetNextAccumulator = this.tolerance != 0;
		for (const command of input.commands) {
			if (command instanceof CommandWait) {
				accumulator += command.ticks * this.tickFrequency;
				if (command.ticks >= this.waitThreshold) {
					const ticks = Math.floor((accumulator + this.tolerance * input.tickFrequency) / input.tickFrequency);
					if (ticks >= 1) {
						accumulator -= ticks * input.tickFrequency;
						if (resetNextAccumulator) {
							outputTicks += accumulator / input.tickFrequency;
							accumulator = 0;
							resetNextAccumulator = false;
						}
						if (this.tolerance) {
							if (accumulator >= this.tolerance * input.tickFrequency) {
								const remainingTicks = accumulator / input.tickFrequency;
								const deviation = remainingTicks < 0.5 ? remainingTicks : remainingTicks - 1;
								throw new Error(`Tolerance exceeded in track ${input.name} at tick ${inputTicks}: ${deviation}`);
							}
							accumulator *= (1 - this.tolerance) ** ticks;
						}
						output.addCommand(CommandWait.of(ticks));
						outputTicks += ticks;
					}
				}
				inputTicks += command.ticks;
			} else {
				output.addCommand(command);
			}
		}
		outputTicks += accumulator / input.tickFrequency;
		if (this.tolerance) {
			output.tickFrequency = input.tickFrequency * outputTicks / inputTicks;
		}
		return output;
	}

	applyOPL4Timer(input) {
		let inputTicks = 0;
		let outputTicks = 0;
		let timerActive = false;
		const output = Track.new({...input, tickFrequency: 0});
		for (const command of input.commands) {
			if (command instanceof CommandWait) {
				if (timerActive) {
					inputTicks += command.ticks;
				}
			} else if (command instanceof CommandOPL4Register && command.address == 0x004) {
				if (command.value & 0x80) {
					output.addCommand(CommandWait.of(1));
					outputTicks++;
				} else {
					timerActive = (command.value & 0x03) != 0;
				}
			} else {
				output.addCommand(command);
			}
		}
		if (inputTicks == 0) {
			throw new Error(`No timer active in track ${input.name}.`);
		}
		output.tickFrequency = input.tickFrequency * outputTicks / inputTicks;
		return output;
	}
}

export class TransformStartConfigAndWait extends Transform {
	constructor(initFrame = true) {
		super();
		this.initFrame = initFrame;
	}

	apply(input) {
		const output = Track.new(input);
		for (let index = 0; index < input.commands.length; ++index) {
			const command = input.commands[index];
			if (command instanceof CommandWait) {
				// skip
			} else if (command instanceof CommandGD3 || command instanceof CommandOPNConfig ||
				command instanceof CommandOPL4Config || command instanceof CommandOPL4WaveMemory ||
				(command instanceof CommandOPL4Register && command.address == 0x0BD) ||
				(command instanceof CommandOPL4Register && command.address == 0x104) ||
				(command instanceof CommandOPL4Register && command.address == 0x105) ||
				(command instanceof CommandOPL4Register && command.address == 0x202) ||
				command instanceof CommandOPLLConfig || command instanceof CommandPSGConfig) {
				output.addCommand(command);
			} else {
				if (this.initFrame) {
					output.addCommand(CommandWait.of(1));
				}
				output.addCommands(input.commands.slice(index, input.commands.length));
				break;
			}
		}
		return output;
	}
}

export class TransformEndLoop extends Transform {
	apply(input) {
		if (input.commands.at(-1) instanceof CommandReturn) {
			const output = Track.new(input);
			const stripCount = input.commands.at(-2) instanceof CommandWait ? 2 : 1;
			output.addCommands(input.commands.slice(0, -stripCount));
			output.addCommand(CommandLabel.of("loop"));
			output.addCommand(CommandWait.of(1));
			output.addCommand(CommandJump.of("loop"));
			return output;
		} else {
			return input;
		}
	}
}

export class TransformCompress extends Transform {
	constructor(format, minimumLength = 1) {
		super();
		this.format = format;
		this.minimumLength = minimumLength;
	}

	apply(input) {
		if (this.minimumLength == Infinity) {
			return input;
		}

		const indexSymbols = new Set(input.getIndex().map(name => Symbol.for(name)));
		let grammar = input.getCommandsGrammar();

		grammar = grammar.compress({ minimumLength: this.minimumLength });
		grammar = grammar.inlineUnitRules();
		grammar = this.inlineSmallRules(grammar, indexSymbols);
		grammar = this.inlineNonRepeats(grammar, indexSymbols);
		grammar = grammar.getReachableRules();
		grammar = this.sortTailCalls(grammar);

		const output = Track.new(input);
		output.addCommandsGrammar(grammar);
		return output;
	}

	inlineSmallRules(grammar, blacklist) {
		const format = this.format;
		const callCommand = new CommandCall("dummy");
		const returnCommand = new CommandReturn();
		const occurrenceCounts = grammar.getOccurrenceCounts();
		return grammar.inline((expansion, nonTerminal) => {
			if (blacklist.has(nonTerminal)) {
				return false;
			}
			const frequency = occurrenceCounts.get(nonTerminal);
			let inlineSize = 0;
			let outlineSize = frequency * format.getSize(callCommand) + format.getSize(returnCommand);
			let inlinePreceding = undefined;
			let outlinePreceding = undefined;
			for (let command of expansion) {
				if (typeof command == "symbol") {
					command = callCommand;
				}
				inlineSize += format.getSize(command, inlinePreceding);
				outlineSize += format.getSize(command, outlinePreceding);
				inlinePreceding = undefined;
				outlinePreceding = command;
			}
			return outlineSize >= inlineSize * frequency;
		});
	}

	inlineNonRepeats(grammar, blacklist) {
		const occurrenceCounts = grammar.getOccurrenceCounts();
		return grammar.inline((_, nonTerminal) => !blacklist.has(nonTerminal) && occurrenceCounts.get(nonTerminal) < 2);
	}

	sortTailCalls(grammar, nextNonTerminal = Grammar.start) {
		let tailCalls = new Set();
		for (const [nonTerminal, expansion] of grammar) {
			const symbol = expansion.at(-1);
			if (grammar.has(symbol) && symbol != nonTerminal) {
				tailCalls.add(symbol);
			}
		}
		let nonTailCalls = new Set();
		for (const nonTerminal of grammar.keys()) {
			if (!tailCalls.has(nonTerminal)) {
				nonTailCalls.add(nonTerminal);
			}
		}
		const counts = grammar.getOccurrenceCounts();
		tailCalls = new Set([...tailCalls].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)));
		nonTailCalls = new Set([...nonTailCalls].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)));

		const rules = new Map();
		while (true) {
			const expansion = grammar.get(nextNonTerminal);
			rules.set(nextNonTerminal, expansion);
			tailCalls.delete(nextNonTerminal);
			nonTailCalls.delete(nextNonTerminal);
			if (tailCalls.has(expansion.at(-1))) {
				nextNonTerminal = expansion.at(-1);
			} else if (nonTailCalls.size > 0) {
				nextNonTerminal = nonTailCalls.values().next().value;
			} else if (tailCalls.size > 0) {
				nextNonTerminal = tailCalls.values().next().value;
			} else {
				break;
			}
		}
		return new Grammar(rules);
	}
}

export class TransformValidate extends Transform {
	constructor(stackCapacity) {
		super();
		this.stackCapacity = stackCapacity;
	}

	apply(input) {
		const coverage = Array(input.commands.length).fill(false);
		const player = new Player(input, this.stackCapacity);

		for (let i = 0; i < player.indexCount; i++) {
			player.play(i);
			player.run((command, index) => {
				coverage[index] = true;
				if (player.process(command, index)) {
					player.stop();
				}
			});
		}

		if (!(player.getCommand(player.stack.at(-1) - 1) instanceof CommandWait)) {
			throw new Error("No wait after loop.");
		}

		if (coverage.some(visited => !visited)) {
			throw new Error("Track has unused commands.");
		}

		return input;
	}
}
