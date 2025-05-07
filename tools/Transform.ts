import { Grammar } from "lfs2-compression";
import { type Command, CommandCall, CommandGD3, CommandJump, CommandLabel, CommandReturn, CommandWait } from "./Command.ts";
import { CommandOPNConfig } from "./CommandFM.ts";
import { CommandOPL4Config, CommandOPL4Register, CommandOPL4WaveMemory } from "./CommandOPL4.ts";
import { CommandOPLLConfig } from "./CommandOPLL.ts";
import { CommandPSGConfig } from "./CommandPSG.ts";
import type { Format } from "./Format.ts";
import { Player } from "./Player.ts";
import { Track } from "./Track.ts";

export class Transform {
	apply(input: Track) {
		return input;
	}
}

export class TransformGroup {
	private readonly transforms: readonly Transform[];

	constructor(transforms: readonly Transform[] = []) {
		this.transforms = transforms;
	}

	apply(input: Track) {
		return this.transforms.reduce((input, transform) => transform.apply(input), input);
	}
}

export class TransformMoveWaitAfterLoop extends Transform {
	apply(input: Track) {
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
	private readonly tickFrequency: number | "opl4-timer";
	private readonly waitThreshold: number;
	private readonly tolerance: number;

	constructor(tickFrequency: number | "opl4-timer" = 44100, waitThreshold = 0, tolerance = 0) {
		super();
		if (tolerance < 0 || tolerance > 0.5)
			throw new Error("Tolerance must not exceed 0.5.");
		this.tickFrequency = tickFrequency;
		this.waitThreshold = waitThreshold;
		this.tolerance = tolerance;
	}

	apply(input: Track) {
		if (this.tickFrequency == "opl4-timer") {
			return this.applyOPL4Timer(input);
		} else {
			return this.applyHertz(input);
		}
	}

	private applyHertz(input: Track) {
		const output = Track.new({...input, tickFrequency: this.tickFrequency as number});
		let inputTicks = 0;
		let outputTicks = 0;
		let accumulator = 0;
		let resetNextAccumulator = this.tolerance != 0;
		for (const command of input.commands) {
			if (command instanceof CommandWait) {
				accumulator += command.ticks * (this.tickFrequency as number);
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

	private applyOPL4Timer(input: Track) {
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
	private readonly initFrame: boolean;

	constructor(initFrame = true) {
		super();
		this.initFrame = initFrame;
	}

	apply(input: Track) {
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
	apply(input: Track) {
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
	private readonly format: Format;
	private readonly minimumLength: number;

	constructor(format: Format, minimumLength = 1) {
		super();
		this.format = format;
		this.minimumLength = minimumLength;
	}

	apply(input: Track) {
		if (this.minimumLength == Infinity) {
			return input;
		}

		const startSymbol = Symbol("Start");
		const indexSymbols = new Set(input.getIndex().map(name => Symbol.for(name)));
		let grammar = input.getCommandsGrammar(startSymbol);

		grammar = grammar.compress(Symbol, { minimumLength: this.minimumLength });
		grammar = grammar.inlineUnitRules();
		grammar = this.inlineSmallRules(grammar, startSymbol, indexSymbols);
		grammar = this.inlineNonRepeats(grammar, startSymbol, indexSymbols);
		grammar = grammar.getReachableRules(new Set([startSymbol]));
		grammar = this.sortTailCalls(grammar, startSymbol);

		const output = Track.new(input);
		output.addCommandsGrammar(grammar, startSymbol);
		return output;
	}

	inlineSmallRules(grammar: Grammar<Command, symbol>, startSymbol: symbol, blacklist: Set<symbol>) {
		const format = this.format;
		const callCommand = new CommandCall("dummy");
		const returnCommand = new CommandReturn();
		const occurrenceCounts = grammar.getOccurrenceCounts();
		return grammar.inline(startSymbol, (expansion, nonTerminal) => {
			if (blacklist.has(nonTerminal)) {
				return false;
			}
			const frequency = occurrenceCounts.get(nonTerminal);
			let inlineSize = 0;
			let outlineSize = frequency * format.getSize(callCommand) + format.getSize(returnCommand);
			let inlinePreceding: Command | undefined;
			let outlinePreceding: Command | undefined;
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

	inlineNonRepeats(grammar: Grammar<Command, symbol>, startSymbol: symbol, blacklist: Set<symbol>) {
		const occurrenceCounts = grammar.getOccurrenceCounts();
		return grammar.inline(startSymbol, (expansion, nonTerminal) => {
			return !blacklist.has(nonTerminal) && occurrenceCounts.get(nonTerminal) < 2
		});
	}

	sortTailCalls(grammar: Grammar<Command, symbol>, nextNonTerminal: symbol) {
		let tailCalls = new Set<symbol>();
		for (const [nonTerminal, expansion] of grammar) {
			const symbol = expansion.at(-1);
			if (grammar.has(symbol as symbol) && symbol != nonTerminal) {
				tailCalls.add(symbol as symbol);
			}
		}
		let nonTailCalls = new Set<symbol>();
		for (const nonTerminal of grammar.keys()) {
			if (!tailCalls.has(nonTerminal)) {
				nonTailCalls.add(nonTerminal);
			}
		}
		const counts = grammar.getOccurrenceCounts();
		tailCalls = new Set([...tailCalls].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)));
		nonTailCalls = new Set([...nonTailCalls].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)));

		const rules = new Map<symbol, (Command | symbol)[]>();
		while (true) {
			const expansion = grammar.get(nextNonTerminal);
			rules.set(nextNonTerminal, expansion);
			tailCalls.delete(nextNonTerminal);
			nonTailCalls.delete(nextNonTerminal);
			if (tailCalls.has(expansion.at(-1) as symbol)) {
				nextNonTerminal = expansion.at(-1) as symbol;
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
	private readonly stackCapacity?: number;

	constructor(stackCapacity?: number) {
		super();
		this.stackCapacity = stackCapacity;
	}

	apply(input: Track) {
		const coverage = Array<boolean>(input.commands.length).fill(false);
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
