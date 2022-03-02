import { Transform } from "./Transform.js";
import { Track } from "./Track.js";
import { CommandJump, CommandWait } from "./Command.js";
import { CommandOPL4Register, CommandOPL4WaitLoad, CommandOPL4WaveMemory } from "./CommandOPL4.js";
import { ChipOPL4 } from "./ChipOPL4.js";
import { rangeMap } from "./utils.js";

export class TransformOPL4InsertWaitLoads extends Transform {
	apply(input) {
		const output = new Track(input.name, input.tickFrequency);
		let loadChannels = 0;
		const emitWaitLoad = () => {
			output.addCommand(CommandOPL4WaitLoad.of());
			loadChannels = 0;
		};
		for (const command of input.commands) {
			if (!(command instanceof CommandOPL4WaitLoad)) {
				if (command instanceof CommandOPL4Register) {
					if (command.address >= 0x208 && command.address < 0x220) {
						if (loadChannels & 1 << command.channel) {
							emitWaitLoad();
						}
						loadChannels |= 1 << command.channel;
					} else if (command.address >= 0x268 && command.address < 0x280 && command.value & 0x80) {
						if (loadChannels & 1 << command.channel) {
							emitWaitLoad();
						}
					} else if (command.address >= 0x280 && command.address < 0x2F8) {
						if (loadChannels & 1 << command.channel) {
							emitWaitLoad();
						}
					}
				} else if (loadChannels && command instanceof CommandJump) {
					emitWaitLoad();
				}
				output.addCommand(command);
			}
		}
		return output;
	}
}

export class TransformOPL4FrameSanitizer extends Transform {
	apply(input) {
		const output = new Track(input.name, input.tickFrequency);
		const emit = command => output.addCommand(command);
		const opl4Input = new ChipOPL4();
		const opl4Output = new ChipOPL4();
		const channels = rangeMap(24, channel => new OPL4FrameSanitizerChannel(channel));
		for (const command of input.commands) {
			if (command instanceof CommandOPL4Register) {
				if (command.address >= 0x208 && command.address < 0x2F8) {
					channels[command.channel].processRegisterWrite(opl4Input, opl4Output, command.address, command.value);
				} else {
					opl4Input.set(command.address, command.value);
				}
			} else if (command instanceof CommandOPL4WaveMemory) {
				opl4Input.setMemory(command.memory, command.romSize, command.ramSize);
				opl4Output.setMemory(command.memory, command.romSize, command.ramSize);
				output.addCommand(command);
			} else if (command instanceof CommandWait || command instanceof CommandJump) {
				for (const channel of channels) {
					channel.processFrame(opl4Input, opl4Output);
				}
				for (const channel of channels) {
					if (channel.waveTableChanged)
						channel.emitKeyOff(opl4Input, opl4Output, emit);
				}
				for (const channel of channels) {
					if (channel.waveTableChanged)
						channel.emitWaveTable(opl4Input, opl4Output, emit);
				}
				for (const channel of channels) {
					channel.emitKeyOff(opl4Input, opl4Output, emit);
				}
				for (const channel of channels) {
					channel.emitFrequency(opl4Input, opl4Output, emit);
				}
				for (const channel of channels) {
					channel.emitTotalLevel(opl4Input, opl4Output, emit);
				}
				for (const channel of channels) {
					if (!channel.waveTableChanged)
						channel.emitLFOADSR(opl4Input, opl4Output, emit);
				}
				for (const channel of channels) {
					if (!channel.waveTableChanged)
						channel.emitKeyOn(opl4Input, opl4Output, emit);
				}
				for (const channel of channels) {
					channel.emitLFOADSR(opl4Input, opl4Output, emit);
				}
				for (const channel of channels) {
					channel.emitKeyOn(opl4Input, opl4Output, emit);
				}
				output.addCommand(command);
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}
}

class OPL4FrameSanitizerChannel {
	constructor(channel) {
		this.channel = channel;
		this.firstKeyOn = false;
		this.firstKeyOnOutput = false;
		this.waveTableChanged = false;
		this.keyOff = -1;
		this.totalLevelDirect = -1;
		this.waveTableHigh = 0;
	}

	processRegisterWrite(opl4Input, opl4Output, address, value) {
		if (address >= 0x268 && address < 0x280) {
			if (value & 0x10) {
				value = value & 0xE0 | 0x08;  // Use pan -8 to mute instead of CH DO2.
			}
			if (value & 0x80) {
				this.firstKeyOn = true;
			} else {
				this.keyOff = this.keyOff >= 0 ? this.keyOff & 0x20 | value : value;
			}
		} else if (address >= 0x250 && address < 0x268) {
			if (value & 1) {
				this.totalLevelDirect = value;
			}
		} else if (address >= 0x208 && address < 0x220) {
			this.waveTableHigh = opl4Input.get(address + 24) & 1;
		}
		opl4Input.set(address, value);
	}

	processFrame(opl4Input, opl4Output) {
		this.waveTableChanged = opl4Input.isSet(0x208 + this.channel) && (!opl4Output.isSet(0x208 + this.channel) ||
			!opl4Input.getWaveTable(this.channel).equals(opl4Output.getWaveTable(this.channel)));
		if (this.waveTableChanged) {
			this.keyOff = this.keyOff >= 0 ? this.keyOff & 0x20 | 0x48 : 0x48;  // Force mute
		}
	}

	emitKeyOff(opl4Input, opl4Output, emit) {
		if (this.firstKeyOnOutput && this.keyOff >= 0) {
			opl4Output.writeRegister(0x268 + this.channel, this.keyOff, emit);
		}
		this.keyOff = -1;
	}

	emitWaveTable(opl4Input, opl4Output, emit) {
		if (this.firstKeyOn) {
			if (!opl4Output.isSet(0x220 + this.channel) || (opl4Output.get(0x220 + this.channel) & 1) != this.waveTableHigh) {
				opl4Output.writeRegister(0x220 + this.channel, opl4Input.get(0x220 + this.channel) & 0xFE | this.waveTableHigh, emit);
			}
			opl4Output.writeRegister(0x208 + this.channel, opl4Input.get(0x208 + this.channel), emit);
		}
	}

	emitFrequency(opl4Input, opl4Output, emit) {
		if (this.firstKeyOn) {
			opl4Output.writeRegister(0x220 + this.channel, opl4Input.get(0x220 + this.channel) & 0xFE | this.waveTableHigh, emit);
			opl4Output.writeRegister(0x238 + this.channel, opl4Input.get(0x238 + this.channel), emit);
		}
	}

	emitTotalLevel(opl4Input, opl4Output, emit) {
		if (this.firstKeyOn) {
			if (this.totalLevelDirect >= 0) {
				opl4Output.writeRegister(0x250 + this.channel, this.totalLevelDirect, emit);
				this.totalLevelDirect = -1;
			}
			opl4Output.writeRegister(0x250 + this.channel, opl4Input.get(0x250 + this.channel), emit);
		}
	}

	emitLFOADSR(opl4Input, opl4Output, emit) {
		if (this.firstKeyOn) {
			opl4Output.writeRegister(0x280 + this.channel, opl4Input.get(0x280 + this.channel), emit);
			opl4Output.writeRegister(0x298 + this.channel, opl4Input.get(0x298 + this.channel), emit);
			opl4Output.writeRegister(0x2B0 + this.channel, opl4Input.get(0x2B0 + this.channel), emit);
			opl4Output.writeRegister(0x2C8 + this.channel, opl4Input.get(0x2C8 + this.channel), emit);
			opl4Output.writeRegister(0x2E0 + this.channel, opl4Input.get(0x2E0 + this.channel), emit);
		}
	}

	emitKeyOn(opl4Input, opl4Output, emit) {
		if (this.firstKeyOn) {
			opl4Output.writeRegister(0x268 + this.channel, opl4Input.get(0x268 + this.channel), emit);
			this.firstKeyOnOutput = true;
		}
	}
}
