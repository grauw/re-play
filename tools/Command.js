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

export class CommandLabel extends Command {
	constructor(name) {
		super();
		this.name = name;
	}

	static of(name) {
		return commandLabelMemo.get(name);
	}

	toString() {
		return `Label ${this.name}`;
	}
}

const commandLabelMemo = new MemoConstructor(CommandLabel);

export class CommandJump extends Command {
	constructor(target) {
		super();
		this.target = target;
	}

	static of(target) {
		return commandJumpMemo.get(target);
	}

	toString() {
		return `Jump ${this.target}`;
	}
}

const commandJumpMemo = new MemoConstructor(CommandJump);

export class CommandCall extends Command {
	constructor(target) {
		super();
		this.target = target;
	}

	static of(target) {
		return commandCallMemo.get(target);
	}

	toString() {
		return `Call ${this.target}`;
	}
}

const commandCallMemo = new MemoConstructor(CommandCall);

export class CommandReturn extends Command {
	static of() {
		return commandReturnMemo;
	}

	toString() {
		return `Return`;
	}
}

const commandReturnMemo = new CommandReturn();
