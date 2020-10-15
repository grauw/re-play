"use strict"
const fs = require('fs');
const { checkTypes } = require('./utils');

class AudioTrack {
	constructor(name) {
		checkTypes(arguments, "string");
		this.name = name;
		this.commands = [];
		this.loop = -1;
	}

	addCommand(command) {
		checkTypes(arguments, AudioCommand);
		if (command instanceof AudioCommandWait && this.commands.length > 0) {
			if (this.commands[this.commands.length - 1] instanceof AudioCommandWait) {
				this.commands.push(command.add(this.commands.pop()));
				return;
			}
		} else if (command instanceof AudioCommandLoop) {
			this.loop = this.commands.length;
		} else if (command instanceof AudioCommandFMInstrument) {
			let tail = [];
			while (this.commands.length > 0 && this.commands[this.commands.length - 1] instanceof AudioCommandFMInstrument) {
				const lastCommand = this.commands.pop();
				if (lastCommand.channel == command.channel) {
					break;
				} else {
					tail.push(lastCommand);
				}
			}
			while (tail.length > 0) {
				this.commands.push(tail.pop());
			}
		}
		this.commands.push(command);
	}

	addCommands(commands) {
		checkTypes(arguments, Array);
		for (const command of commands)
			this.addCommand(command);
	}

	moveWaitAfterLoop() {
		if (this.loop >= 0 && this.commands[this.loop + 1] instanceof AudioCommandWait) {
			const track = new AudioTrack(this.name);
			track.addCommands(this.commands.slice(0, this.loop));
			track.addCommand(this.commands[this.loop + 1]);
			track.addCommand(this.commands[this.loop]);
			track.addCommands(this.commands.slice(this.loop + 2, this.commands.length - 1));
			track.addCommand(this.commands[this.loop + 1]);
			track.addCommand(this.commands[this.commands.length - 1]);
			return track;
		} else {
			return this;
		}
	}

	removeWaitsUnder(threshold) {
		checkTypes(arguments, "number");
		const track = new AudioTrack(this.name);
		let accumulator = 0;
		for (const command of this.commands) {
			if (command instanceof AudioCommandWait) {
				if (command.time >= threshold) {
					track.addCommand(new AudioCommandWait(command.time + accumulator, 44100));
					accumulator = 0;
				} else {
					accumulator += command.time;
				}
			} else if (command instanceof AudioCommandLoop || command instanceof AudioCommandEnd) {
				if (accumulator > 0) {
					track.addCommand(new AudioCommandWait(accumulator, 44100));
					accumulator = 0;
				}
				track.addCommand(command);
			} else {
				track.addCommand(command);
			}
		}
		return track;
	}

	quantise(newTickFrequency) {
		checkTypes(arguments, "number");
		const track = new AudioTrack(this.name);
		let time = 0;
		for (const command of this.commands) {
			if (command instanceof AudioCommandWait) {
				time += command.time * newTickFrequency;
				if (time >= command.tickFrequency) {
					const ticks = Math.floor(time / command.tickFrequency);
					track.addCommand(new AudioCommandWait(ticks, newTickFrequency));
					time -= ticks * command.tickFrequency;
				}
			} else {
				track.addCommand(command);
			}
		}
		return track;
	}

	trimLeadingSilence() {
		const track = new AudioTrack(this.name);
		for (let index = 0; index < this.commands.length; ++index) {
			if (!(this.commands[index] instanceof AudioCommandWait)) {
				track.addCommands(this.commands.slice(index, this.commands.length));
				break;
			}
		}
		return track;
	}

	toFMCommands() {
		const track = new AudioTrack(this.name);
		const registers = new Array(512).fill(0);
		let clockDivider = 6;
		for (const command of this.commands) {
			if (command instanceof AudioCommandOPNB) {
				registers[command.address] = command.value;
				const addressLSB = command.address & 0xFF;
				const channel = (command.address >> 8) << 2 | command.address & 3;
				if (command.address == 0x28) {
					track.addCommand(new AudioCommandFMKey(command.value & 7, command.value >> 4));
				} else if (addressLSB >= 0xA0 && addressLSB < 0xA4) {
					const value = registers[command.address + 4] << 8 | registers[command.address];
					track.addCommand(AudioCommandFMFrequency.ofFNum(channel, (value & 0x7FF) << (value >> 11), command.clockFrequency / clockDivider));
				} else if (addressLSB >= 0x30 && addressLSB < 0x90 || addressLSB >= 0xB0 && addressLSB < 0xB4) {
					const offset = (channel >> 2) << 8 | channel & 3;
					track.addCommand(new AudioCommandFMInstrument(channel,
						registers[0x30 + offset], registers[0x34 + offset], registers[0x38 + offset], registers[0x3C + offset],
						registers[0x40 + offset], registers[0x44 + offset], registers[0x48 + offset], registers[0x4C + offset],
						registers[0x50 + offset], registers[0x54 + offset], registers[0x58 + offset], registers[0x5C + offset],
						registers[0x60 + offset], registers[0x64 + offset], registers[0x68 + offset], registers[0x6C + offset],
						registers[0x70 + offset], registers[0x74 + offset], registers[0x78 + offset], registers[0x7C + offset],
						registers[0x80 + offset], registers[0x84 + offset], registers[0x88 + offset], registers[0x8C + offset],
						registers[0xB0 + offset] | 0xC0
					));
				} else if (command.address >= 0x2D && command.address < 0x30) {
					clockDivider = [6, 3, 2][command.address - 0x2D];
				}
			} else {
				track.addCommand(command);
			}
		}
		return track;
	}

	mapChannels(mapping) {
		checkTypes(arguments, Array);
		const track = new AudioTrack(this.name);
		for (const command of this.commands) {
			if (command instanceof AudioCommandFMChannel) {
				const newChannel = mapping[command.channel];
				if (newChannel < 0) {
					// skip
				} else if (command instanceof AudioCommandFMKey) {
					track.addCommand(new AudioCommandFMKey(mapping[command.channel], command.slots));
				} else if (command instanceof AudioCommandFMFrequency) {
					track.addCommand(new AudioCommandFMFrequency(mapping[command.channel], command.frequency));
				} else if (command instanceof AudioCommandFMInstrument) {
					track.addCommand(new AudioCommandFMInstrument(mapping[command.channel], ...command.parameters));
				}
			} else {
				track.addCommand(command);
			}
		}
		return track;
	}

	attenuateVolume(dB) {
		checkTypes(arguments, "number");
		const track = new AudioTrack(this.name);
		for (const command of this.commands) {
			if (command instanceof AudioCommandFMInstrument) {
				track.addCommand(command.attenuateVolume(dB));
			} else {
				track.addCommand(command);
			}
		}
		return track;
	}

	frequencyBeforeKeyOn() {
		const track = new AudioTrack(this.name);
		let lastCommand = null;
		for (const command of this.commands) {
			if (command instanceof AudioCommandFMFrequency && lastCommand instanceof AudioCommandFMKey &&
				lastCommand.slots && command.channel == lastCommand.channel) {
				track.commands.pop();
				track.addCommand(command);
				track.addCommand(lastCommand);
			} else {
				track.addCommand(command);
			}
			lastCommand = command;
		}
		return track;
	}

	async toGNG(tickFrequency, opnFrequency, opmFrequency) {
		checkTypes(arguments, "number", "number");
		const word = value => [value & 0xFF, (value >> 8) & 0xFF];
		let ticks = 0;
		let loop = -1;
		const data = [];
		for (const command of this.commands) {
			if (command instanceof AudioCommandFMKey) {
				data.push(0x00 | command.slots << 3 | command.channel);
			} else if (command instanceof AudioCommandFMFrequency) {
				const keyCodeFraction = command.getKeyCodeFraction(opmFrequency);
				const fNumBlock = command.getFNumBlock(opnFrequency / 6);
				data.push(0x80 + command.channel, ...word(keyCodeFraction), fNumBlock >> 8, fNumBlock & 0xFF);
			} else if (command instanceof AudioCommandFMInstrument) {
				data.push(0x88 + command.channel, ...command.parameters);
			} else if (command instanceof AudioCommandWait) {
				ticks += command.getTime(tickFrequency);
				while (ticks >= 1) {
					const waitTicks = Math.min(Math.floor(ticks), 0x6F);
					data.push(0x90 + waitTicks);
					ticks -= waitTicks;
				}
			} else if (command instanceof AudioCommandLoop) {
				loop = data.length;
			} else if (command instanceof AudioCommandEnd) {
				if (loop >= 0) {
					data.push(0x90, ...word(loop - data.length - 3));
				} else {
					data.push(0x90 + 1);  // wait 1
					data.push(0x90, ...word(-4));  // loop to wait
				}
			}
		}
		await fs.promises.writeFile(`bin/${this.name}.gng`, Buffer.from(data));
	}

	async toVGMOPNB(opnbFrequency) {
		checkTypes(arguments, "number");
		let samples = 0;
		let loopOffset = -1;
		let loopSamples = -1;
		const commandData = [];
		for (const command of this.commands) {
			if (command instanceof AudioCommandOPNB) {
				commandData.push(0x58 | command.address >> 8, command.address & 0xFF, command.value);
			} else if (command instanceof AudioCommandFMKey) {
				commandData.push(0x58, 0x28, command.slots << 4 | command.channel);
			} else if (command instanceof AudioCommandFMFrequency) {
				const fNumBlock = command.getFNumBlock(opnbFrequency / 6);
				commandData.push(0x58 + (command.channel >> 2), 0xA4 + (command.channel & 3), fNumBlock >> 8);
				commandData.push(0x58 + (command.channel >> 2), 0xA0 + (command.channel & 3), fNumBlock & 0xFF);
			} else if (command instanceof AudioCommandFMInstrument) {
				for (let i = 0; i < 24; i++)
					commandData.push(0x58 + (command.channel >> 2), 0x30 + i * 4 + (command.channel & 3), command.parameters[i]);
				commandData.push(0x58 + (command.channel >> 2), 0xB0 + (command.channel & 3), command.parameters[24]);
			} else if (command instanceof AudioCommandWait) {
				let ticks = Math.round(command.getTime(44100));
				samples += ticks;
				while (ticks > 0) {
					const ticksCapped = Math.min(ticks, 65535);
					commandData.push(0x61, ticksCapped & 0xFF, ticksCapped >> 8);
					ticks -= ticksCapped;
				}
			} else if (command instanceof AudioCommandLoop) {
				loopOffset = commandData.length;
				loopSamples = samples;
			} else if (command instanceof AudioCommandEnd) {
				commandData.push(0x66);
			}
		}

		const data = [];
		const doubleWord = value => [value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF, (value >> 24) & 0xFF];
		data.push(0x56, 0x67, 0x6d, 0x20);  // 00 VGM ID
		data.push(...doubleWord(0x80 + commandData.length - 0x04));  // 04 EOF offset
		data.push(...doubleWord(0x151));  // 08 version number
		data.push(0x00, 0x00, 0x00, 0x00);  // 0C SN76489 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 10 YM2413 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 14 GD3 offset
		data.push(...doubleWord(samples));  // 18 Total # samples
		data.push(...doubleWord(loopOffset >= 0 ? 0x80 + loopOffset - 0x1C : 0));  // 1C Loop offset
		data.push(...doubleWord(loopSamples >= 0 ? samples - loopSamples : 0));  // 20 Loop # samples
		data.push(0x00, 0x00, 0x00, 0x00);  // 24 Rate
		data.push(0x00, 0x00, 0x00, 0x00);  // 28 SN76489 flags
		data.push(0x00, 0x00, 0x00, 0x00);  // 2C YM2612 / YM3438 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 30 YM2151 / YM2164 clock
		data.push(...doubleWord(0x80 - 0x34));  // 34 VGM data offset
		data.push(0x00, 0x00, 0x00, 0x00);  // 38 Sega PCM clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 3C Sega PCM interface register
		data.push(0x00, 0x00, 0x00, 0x00);  // 40 RF5C68 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 44 YM2203 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 48 YM2608 clock
		// data.push(...doubleWord(opnbFrequency | Math.pow(2, 31)));  // 4C YM2610 / YM2610B clock
		data.push(...doubleWord(opnbFrequency));  // 4C YM2610 / YM2610B clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 50 YM3812 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 54 YM3526 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 58 Y8950 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 5C YMF262 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 60 YMF278B clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 64 YMF271 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 68 YMZ280B clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 6C RF5C164 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 70 PWM clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 74 AY8910 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 78 YM2203 / YM2608/AY8910 flags
		data.push(0x00, 0x00, 0x00, 0x00);  // 7C Volume / loop modifiers
		data.push(...commandData);

		await fs.promises.writeFile(`bin/${this.name}-opnb.vgm`, Buffer.from(data));
	}

	async toVGMOPM(opmFrequency) {
		checkTypes(arguments, "number");
		let samples = 0;
		let loopOffset = -1;
		let loopSamples = -1;
		const commandData = [];
		for (const command of this.commands) {
			if (command instanceof AudioCommandOPNB) {
				throw new Error("Use toFMCommands() first.");
			} else if (command instanceof AudioCommandFMKey) {
				commandData.push(0x54, 0x08, command.slots << 3 | command.channel);
			} else if (command instanceof AudioCommandFMFrequency) {
				const keyCodeFraction = command.getKeyCodeFraction(opmFrequency);
				commandData.push(0x54, 0x30 + command.channel, keyCodeFraction & 0xFF);
				commandData.push(0x54, 0x28 + command.channel, keyCodeFraction >> 8);
			} else if (command instanceof AudioCommandFMInstrument) {
				for (let i = 0; i < 24; i++)
					commandData.push(0x54, 0x40 + i * 8 + command.channel, command.parameters[i]);
				commandData.push(0x54, 0x20 + command.channel, command.parameters[24]);
			} else if (command instanceof AudioCommandWait) {
				let ticks = Math.round(command.getTime(44100));
				samples += ticks;
				while (ticks > 0) {
					const ticksCapped = Math.min(ticks, 65535);
					commandData.push(0x61, ticksCapped & 0xFF, ticksCapped >> 8);
					ticks -= ticksCapped;
				}
			} else if (command instanceof AudioCommandLoop) {
				loopOffset = commandData.length;
				loopSamples = samples;
			} else if (command instanceof AudioCommandEnd) {
				commandData.push(0x66);
			}
		}

		const data = [];
		const doubleWord = value => [value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF, (value >> 24) & 0xFF];
		data.push(0x56, 0x67, 0x6d, 0x20);  // 00 VGM ID
		data.push(...doubleWord(0x40 + commandData.length - 0x04));  // 04 EOF offset
		data.push(...doubleWord(0x151));  // 08 version number
		data.push(0x00, 0x00, 0x00, 0x00);  // 0C SN76489 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 10 YM2413 clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 14 GD3 offset
		data.push(...doubleWord(samples));  // 18 Total # samples
		data.push(...doubleWord(loopOffset >= 0 ? 0x40 + loopOffset - 0x1C : 0));  // 1C Loop offset
		data.push(...doubleWord(loopSamples >= 0 ? samples - loopSamples : 0));  // 20 Loop # samples
		data.push(0x00, 0x00, 0x00, 0x00);  // 24 Rate
		data.push(0x00, 0x00, 0x00, 0x00);  // 28 SN76489 flags
		data.push(0x00, 0x00, 0x00, 0x00);  // 2C YM2612 / YM3438 clock
		data.push(...doubleWord(opmFrequency));  // 30 YM2151 / YM2164 clock
		data.push(...doubleWord(0x40 - 0x34));  // 34 VGM data offset
		data.push(0x00, 0x00, 0x00, 0x00);  // 38 Sega PCM clock
		data.push(0x00, 0x00, 0x00, 0x00);  // 3C Sega PCM interface register
		data.push(...commandData);

		await fs.promises.writeFile(`bin/${this.name}-opm.vgm`, Buffer.from(data));
	}

	getUnusedChannels() {
		const usedChannels = new Array(8).fill(false);
		const keyOnChannels = new Array(8).fill(false);
		for (const command of this.commands) {
			if (command instanceof AudioCommandFMChannel) {
				usedChannels[command.channel] = true;
				if (command instanceof AudioCommandFMKey && command.slots) {
					keyOnChannels[command.channel] = true;
				}
			}
		}
		const unusedChannels = [];
		for (let i = 0; i < 8; ++i) {
			if (usedChannels[i] && !keyOnChannels[i]) {
				unusedChannels.push(i);
			}
		}
		return unusedChannels;
	}
}

class AudioCommand {
	constructor() {
	}
}

class AudioCommandOPNB extends AudioCommand {
	constructor(address, value, clockFrequency) {
		checkTypes(arguments, "number", "number", "number");
		if (address >= 0xC0 && address < 0x100 || address >= 0x1C0)
			throw new Error("Invalid OPN register.");
		if ((address & 0xFF) >= 0x90 && (address & 0xFF) < 0xA0)
			throw new Error("SSG-EG not supported.");
		if (address == 0x27 && value & 0xC0)
			throw new Error("CSM or 3ch modes not supported.");
		super();
		this.address = address;
		this.value = value;
		this.clockFrequency = clockFrequency;
	}
}

class AudioCommandFMChannel extends AudioCommand {
	constructor(channel) {
		checkTypes(arguments, "number");
		if (channel < 0 || channel >= 8)
			throw new Error("Channel out of range.");
		super();
		this.channel = channel;
	}
}

class AudioCommandFMKey extends AudioCommandFMChannel {
	constructor(channel, slots) {
		checkTypes(arguments, "number", "number");
		super(channel);
		this.slots = slots;
	}
}

class AudioCommandFMFrequency extends AudioCommandFMChannel {
	constructor(channel, frequency) {
		checkTypes(arguments, "number", "number");
		super(channel);
		this.frequency = frequency;
	}

	getFNumBlock(opnFrequency) {
		checkTypes(arguments, "number");
		const fNum = Math.min(this.frequency * ((24 << 21) / opnFrequency), 0x3FFFF);
		const block = Math.max(Math.floor(Math.log2(fNum) - 10), 0);
		const fNumRounded = fNum + Math.pow(2, block - 1);
		const blockRounded = Math.max(Math.floor(Math.log2(fNumRounded) - 10), 0);
		return blockRounded << 11 | fNumRounded >> block;
	}

	getKeyCodeFraction(opmFrequency) {
		checkTypes(arguments, "number");
		const logarithm = Math.log2(this.frequency / 440 * (3579545 / opmFrequency)) + 4 + 8 / 12;
		const keyFraction = Math.min(Math.max(Math.round(logarithm * 12 * 64), 0), 8 * 12 * 64 - 1);
		const note = Math.floor(keyFraction / 64);
		const octave = Math.floor(note / 12);
		const noteMap = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14];
		return octave << 12 | noteMap[note % 12] << 8 | keyFraction % 64 << 2;
	}

	static ofFNum(channel, fNum, opnFrequency) {
		checkTypes(arguments, "number", "number", "number");
		if (fNum < 0 || fNum > 0x3FFFF)
			throw new Error("FNum out of range.");
		return new AudioCommandFMFrequency(channel, fNum * (opnFrequency / (24 << 21)));
	}
}

class AudioCommandFMInstrument extends AudioCommandFMChannel {
	constructor(channel, ...parameters) {
		checkTypes(arguments, "number");
		if (parameters.length != 25)
			throw new Error("Incorrect number of parameters.");
		super(channel);
		this.parameters = parameters;
	}

	attenuateVolume(dB) {
		checkTypes(arguments, "number");
		const instrument = new AudioCommandFMInstrument(this.channel, ...this.parameters);
		switch (instrument.parameters[24] & 7) {
			case 7:
				instrument._attenuateOperator(0, dB);
			case 6:
			case 5:
				instrument._attenuateOperator(1, dB);
			case 4:
				instrument._attenuateOperator(2, dB);
			default:
				instrument._attenuateOperator(3, dB);
		}
		return instrument;
	}

	_attenuateOperator(operator, dB) {
		this.parameters[4 + operator] = Math.min(Math.max(Math.round(this.parameters[4 + operator] - dB * 8 / 6), 0), 127);
	}
}

class AudioCommandWait extends AudioCommand {
	constructor(time, tickFrequency) {
		checkTypes(arguments, "number", "number");
		super();
		this.time = time;
		this.tickFrequency = tickFrequency;
	}

	getTime(tickFrequency = this.tickFrequency) {
		checkTypes(arguments, "number");
		return tickFrequency == this.tickFrequency ? this.time : this.time * tickFrequency / this.tickFrequency;
	}

	add(other) {
		checkTypes(arguments, AudioCommandWait);
		if (other.tickFrequency != this.tickFrequency)
			throw new Error("Base timing frequency mismatch.");
		return new AudioCommandWait(this.time + other.time, this.tickFrequency);
	}
}

class AudioCommandLoop extends AudioCommand {
	constructor() {
		super();
	}
}

class AudioCommandEnd extends AudioCommand {
	constructor() {
		super();
	}
}

class VGMLoader {
	constructor(name, path) {
		checkTypes(arguments, "string", "string");
		this.name = name;
		this.path = path;
	}

	async loadTrack() {
		const vgm = await fs.promises.readFile(this.path);
		const getByte = address => vgm[address];
		const getWord = address => getByte(address) | getByte(address + 1) << 8;
		const getDoubleWord = address => getWord(address) | getWord(address + 2) << 16;
		if (getDoubleWord(0x00) != 0x206d6756)
			throw new Error("Not a VGM file.");
		const version = getDoubleWord(0x08);
		const loop = getDoubleWord(0x1C) ? getDoubleWord(0x1C) + 0x1C : 0;
		const headerSize = version >= 0x150 ? getDoubleWord(0x34) + 0x34 : 0x40;
		const opnFrequency = version >= 0x150 && headerSize >= 0x48 ? getDoubleWord(0x44) & 0x3FFFFFFF : 0;
		const tickFrequency = 44100;
		const track = new AudioTrack(this.name);
		let address = headerSize;
		while (address < vgm.length) {
			if (address == loop)
				track.addCommand(new AudioCommandLoop());
			const type = getByte(address++);
			if (type == 0x55) {
				const register = getByte(address++);
				const value = getByte(address++);
				track.addCommand(new AudioCommandOPNB(register, value, opnFrequency * 2));
			} else if (type == 0xA5) {
				const register = getByte(address++);
				const value = getByte(address++);
				if (register == 0x28) {
					track.addCommand(new AudioCommandOPNB(register, value | 4, opnFrequency * 2));
				} else if (register >= 0x30) {
					track.addCommand(new AudioCommandOPNB(register | 0x100, value, opnFrequency * 2));
				}
			} else if (type == 0x61) {
				track.addCommand(new AudioCommandWait(getWord(address), tickFrequency));
				address += 2;
			} else if (type == 0x62) {
				track.addCommand(new AudioCommandWait(735, tickFrequency));
			} else if (type == 0x63) {
				track.addCommand(new AudioCommandWait(882, tickFrequency));
			} else if (type == 0x66) {
				track.addCommand(new AudioCommandEnd());
				break;
			} else if (type >= 0x70 && type < 0x80) {
				track.addCommand(new AudioCommandWait((type & 15) + 1, tickFrequency));
			} else {
				throw new Error(`Unsupported command ${type.toString(16)} at address ${(address - 1).toString(16)}`);
			}
		}
		return track;
	}
}

exports.AudioTrack = AudioTrack;
exports.VGMLoader = VGMLoader;
