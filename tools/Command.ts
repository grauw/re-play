import { MemoConstructor } from "./utils.ts";

export abstract class Command {
	constructor() {
	}

	toString() {
		return `Command`;
	}
}

export class CommandWait extends Command {
	public readonly ticks: number;

	constructor(ticks: number) {
		super();
		if (!Number.isInteger(ticks) || ticks < 1)
			throw new Error("Ticks count is not a positive integer.");
		this.ticks = ticks;
		Object.freeze(this);
	}

	static of(ticks: number) {
		return commandWaitMemo.get(ticks);
	}

	add(other: CommandWait) {
		return CommandWait.of(this.ticks + other.ticks);
	}

	toString() {
		return `Wait ${this.ticks}`;
	}
}

const commandWaitMemo = new MemoConstructor(CommandWait);

export abstract class CommandControlFlow extends Command {
	toString() {
		return `CommandControlFlow`;
	}
}

export class CommandLabel extends CommandControlFlow {
	public readonly name: string;

	constructor(name: string) {
		super();
		this.name = name;
		Object.freeze(this);
	}

	static of(name: string) {
		return commandLabelMemo.get(name);
	}

	toString() {
		return `Label ${this.name}`;
	}
}

const commandLabelMemo = new MemoConstructor(CommandLabel);

export class CommandJump extends CommandControlFlow {
	public readonly target: string;

	constructor(target: string) {
		super();
		this.target = target;
		Object.freeze(this);
	}

	static of(target: string) {
		return commandJumpMemo.get(target);
	}

	toString() {
		return `Jump ${this.target}`;
	}
}

const commandJumpMemo = new MemoConstructor(CommandJump);

export class CommandCall extends CommandControlFlow {
	public readonly target: string;

	constructor(target: string) {
		super();
		this.target = target;
		Object.freeze(this);
	}

	static of(target: string) {
		return commandCallMemo.get(target);
	}

	toString() {
		return `Call ${this.target}`;
	}
}

const commandCallMemo = new MemoConstructor(CommandCall);

export class CommandReturn extends CommandControlFlow {
	static of() {
		return commandReturnMemo;
	}

	toString() {
		return `Return`;
	}
}

const commandReturnMemo = Object.freeze(new CommandReturn());

export class CommandNop extends Command {
	static of() {
		return commandNopMemo;
	}

	toString() {
		return `CommandNop`;
	}
}

const commandNopMemo = Object.freeze(new CommandNop());

export class CommandGD3 extends Command {
	public readonly tag: string;

	constructor(tag: string) {
		super();
		this.tag = tag;
		Object.freeze(this);
	}

	static of(tag: string) {
		return commandGD3Memo.get(tag);
	}

	toString() {
		return `GD3 ${this.tag.split(/[\0\n]/).join("\n  | ")}`;
	}
}

const commandGD3Memo = new MemoConstructor(CommandGD3);
