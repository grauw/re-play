import { MemoConstructor } from "./utils.js";

export class Command {
	constructor() {
	}

	toString() {
		return `Command`;
	}
}

export class CommandWait extends Command {
	constructor(time, tickFrequency) {
		super();
		this.time = time;
		this.tickFrequency = tickFrequency;
	}

	static of(time, tickFrequency) {
		return commandWaitMemo.get(time, tickFrequency);
	}

	getTime(tickFrequency = this.tickFrequency) {
		return tickFrequency == this.tickFrequency ? this.time : this.time * tickFrequency / this.tickFrequency;
	}

	add(other) {
		if (other.tickFrequency != this.tickFrequency)
			throw new Error("Base timing frequency mismatch.");
		return CommandWait.of(this.time + other.time, this.tickFrequency);
	}

	toString() {
		return `Wait ${this.time} / ${this.tickFrequency} s`;
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
