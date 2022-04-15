import { MemoConstructor } from "./utils.js";

export class Command {
	constructor() {
	}

	toString() {
		return `Command`;
	}
}

export class CommandWait extends Command {
	constructor(ticks) {
		super();
		if (!Number.isInteger(ticks))
			throw new Error("Non-integer ticks count.");
		this.ticks = ticks;
		Object.freeze(this);
	}

	static of(ticks) {
		return commandWaitMemo.get(ticks);
	}

	add(other) {
		return CommandWait.of(this.ticks + other.ticks);
	}

	toString() {
		return `Wait ${this.ticks}`;
	}
}

const commandWaitMemo = new MemoConstructor(CommandWait);

export class CommandControlFlow extends Command {
	toString() {
		return `CommandControlFlow`;
	}
}

export class CommandLabel extends CommandControlFlow {
	constructor(name) {
		super();
		this.name = name;
		Object.freeze(this);
	}

	static of(name) {
		return commandLabelMemo.get(name);
	}

	toString() {
		return `Label ${this.name}`;
	}
}

const commandLabelMemo = new MemoConstructor(CommandLabel);

export class CommandJump extends CommandControlFlow {
	constructor(target) {
		super();
		this.target = target;
		Object.freeze(this);
	}

	static of(target) {
		return commandJumpMemo.get(target);
	}

	toString() {
		return `Jump ${this.target}`;
	}
}

const commandJumpMemo = new MemoConstructor(CommandJump);

export class CommandCall extends CommandControlFlow {
	constructor(target) {
		super();
		this.target = target;
		Object.freeze(this);
	}

	static of(target) {
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

export class CommandGD3 extends Command {
	constructor(tag) {
		super();
		this.tag = tag;
		Object.freeze(this);
	}

	static of(tag) {
		return commandGD3Memo.get(tag);
	}

	toString() {
		return `GD3 ${this.tag.split(/[\0\n]/).join("\n  | ")}`;
	}
}

const commandGD3Memo = new MemoConstructor(CommandGD3);
