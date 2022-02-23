import { MemoConstructor } from "./utils.js";
import { Command } from "./Command.js";

export class CommandOPL4 extends Command {
	toString() {
		return `OPL4`;
	}
}

export class CommandOPL4WaitLoad extends CommandOPL4 {
	static of() {
		return commandOPL4WaitLoadMemo;
	}

	toString() {
		return "OPL4WaitLoad";
	}
}

const commandOPL4WaitLoadMemo = new CommandOPL4WaitLoad();

export class CommandOPL4Wave extends CommandOPL4 {
	constructor(register, value) {
		super();
		this.register = register;
		this.value = value;
	}

	static of(register, value) {
		return commandOPL4WaveMemo.get(register, value);
	}

	toString() {
		let description = "";
		const channel = (this.register - 0x08) % 24;
		if (this.register >= 0x08 && this.register < 0x20)
			description = `Ch${channel} Wave Table Number Low`;
		if (this.register >= 0x20 && this.register < 0x38)
			description = `Ch${channel} F-Number Low, Wave Table Number High`;
		if (this.register >= 0x38 && this.register < 0x50)
			description = `Ch${channel} F-Number High, Octave, Pseudo-Reverb`;
		if (this.register >= 0x50 && this.register < 0x68)
			description = `Ch${channel} Total Level, Level Direct`;
		if (this.register >= 0x68 && this.register < 0x80)
			description = `Ch${channel} Key On, Damp, LFO Reset, Ch, Panpot`;
		if (this.register >= 0x80 && this.register < 0x98)
			description = `Ch${channel} LFO Speed, VIB Depth`;
		if (this.register >= 0x98 && this.register < 0xB0)
			description = `Ch${channel} Attack Rate, Decay 1 Rate`;
		if (this.register >= 0xB0 && this.register < 0xC8)
			description = `Ch${channel} Decay Level, Decay 2 Rate`;
		if (this.register >= 0xC8 && this.register < 0xE0)
			description = `Ch${channel} Rate Correction, Release Rate`;
		if (this.register >= 0xE0 && this.register < 0xF8)
			description = `Ch${channel} Tremolo Depth`;
		if (this.register >= 0xF8 && this.register < 0xF9)
			description = `Mixing Control`;

		return `OPL4Wave ${("0" + this.register.toString(16)).slice(-2)}, ${("0" + this.value.toString(16)).slice(-2)}${description ? " - " + description : ""}`;
	}
}

const commandOPL4WaveMemo = new MemoConstructor(CommandOPL4Wave);
