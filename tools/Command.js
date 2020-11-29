import { checkTypes, MemoConstructor } from "./utils.js";

export class Command {
	constructor() {
	}
}

export class CommandWait extends Command {
	constructor(time, tickFrequency) {
		checkTypes(arguments, "number", "number");
		super();
		this.time = time;
		this.tickFrequency = tickFrequency;
	}

	static of(time, tickFrequency) {
		return commandWaitMemo.get(time, tickFrequency);
	}

	getTime(tickFrequency = this.tickFrequency) {
		checkTypes(arguments, "number");
		return tickFrequency == this.tickFrequency ? this.time : this.time * tickFrequency / this.tickFrequency;
	}

	add(other) {
		checkTypes(arguments, CommandWait);
		if (other.tickFrequency != this.tickFrequency)
			throw new Error("Base timing frequency mismatch.");
		return CommandWait.of(this.time + other.time, this.tickFrequency);
	}
}

const commandWaitMemo = new MemoConstructor(CommandWait);

export class CommandLabel extends Command {
	constructor(name) {
		checkTypes(arguments, "string");
		super();
		this.name = name;
	}

	static of(name) {
		return commandLabelMemo.get(name);
	}
}

const commandLabelMemo = new MemoConstructor(CommandLabel);

export class CommandJump extends Command {
	constructor(target) {
		checkTypes(arguments, "string");
		super();
		this.target = target;
	}

	static of(target) {
		return commandJumpMemo.get(target);
	}
}

const commandJumpMemo = new MemoConstructor(CommandJump);

export class CommandCall extends Command {
	constructor(target) {
		checkTypes(arguments, "string");
		super();
		this.target = target;
	}

	static of(target) {
		return commandCallMemo.get(target);
	}
}

const commandCallMemo = new MemoConstructor(CommandCall);

export class CommandReturn extends Command {
	static of() {
		return commandReturnMemo;
	}
}

const commandReturnMemo = new CommandReturn();
