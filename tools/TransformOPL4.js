import { Transform } from "./Transform.js";
import { Track } from "./Track.js";
import { CommandWait, CommandControlFlow, CommandLabel, CommandJump } from "./Command.js";
import { CommandOPL4Register, CommandOPL4WaitLoad, CommandOPL4WaveMemory } from "./CommandOPL4.js";
import { ChipOPL4 } from "./ChipOPL4.js";
import { Register } from "./Chip.js";
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
						if (loadChannels & 1 << command.waveChannel) {
							emitWaitLoad();
						}
						loadChannels |= 1 << command.waveChannel;
					} else if (command.address >= 0x268 && command.address < 0x280 && command.value & 0x80) {
						if (loadChannels & 1 << command.waveChannel) {
							emitWaitLoad();
						}
					} else if (command.address >= 0x280 && command.address < 0x2F8) {
						if (loadChannels & 1 << command.waveChannel) {
							emitWaitLoad();
						}
					}
				} else if (loadChannels && command instanceof CommandControlFlow) {
					emitWaitLoad();
				}
				output.addCommand(command);
			}
		}
		return output;
	}
}

const ignoreAddresses = [
	0x000, 0x001, 0x002, 0x003, 0x004, 0x100, 0x101, 0x105,
	0x200, 0x201, 0x203, 0x204, 0x205, 0x206, 0x2F8, 0x2F9
];

export class TransformOPL4FrameSanitizer extends Transform {
	apply(input) {
		const output = new Track(input.name, input.tickFrequency);
		const emit = command => output.addCommand(command);
		const opl4Input = new ChipOPL4();
		const opl4Output = new ChipOPL4();
		for (const address of ignoreAddresses) {
			opl4Output.getRegister(address).mask &= 0x00;
		}
		opl4Output.getRegister(0x202).mask = 0x1C;
		const channels = rangeMap(24, channel => new OPL4FrameSanitizerChannel(channel));
		for (const command of input.commands) {
			if (command instanceof CommandOPL4Register) {
				if (command.address >= 0x208 && command.address < 0x2F8) {
					channels[command.waveChannel].processRegisterWrite(opl4Input, opl4Output, command.address, command.value);
				} else {
					if (opl4Input.set(command.address, command.value)) {
						writeRegisterIfSet(opl4Output, opl4Input.getRegister(command.address), emit);
					}
				}
			} else if (command instanceof CommandOPL4WaveMemory) {
				opl4Input.setMemory(command.memory, command.romSize, command.ramSize);
				opl4Output.setMemory(command.memory, command.romSize, command.ramSize);
				output.addCommand(command);
			} else if (command instanceof CommandWait || command instanceof CommandControlFlow) {
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
				if (command instanceof CommandLabel && command.name == "loop") {
					this.unsetLoopChanges(input, opl4Output, channels, "loop");
				}
				output.addCommand(command);
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}

	unsetLoopChanges(input, opl4Output, channels, target) {
		const opl4Loop = new ChipOPL4();
		for (const command of input.commands) {
			if (command instanceof CommandOPL4Register) {
				opl4Loop.set(command.address, command.value);
				if (command.address >= 0x268 && command.address < 0x280 && command.value & 0x80) {
					channels[command.waveChannel].firstKeyOnOutput = true;
				}
			} else if (command instanceof CommandOPL4WaveMemory) {
				opl4Loop.setMemory(command.memory, command.romSize, command.ramSize);
			} else if (command instanceof CommandJump && command.target == target) {
				break;
			}
		}
		for (let address = 0x000; address < 0x300; address++) {
			if (!opl4Output.getRegister(address).equals(opl4Loop.getRegister(address))) {
				opl4Output.unset(address);
			}
		}
		for (let channel = 0; channel < 24; channel++) {
			if (!opl4Output.getWaveTable(channel).equals(opl4Loop.getWaveTable(channel))) {
				opl4Output.unset(0x208 + channel);
			}
			if (opl4Loop.isSet(0x268 + channel) && opl4Loop.get(0x268 + channel) & 0x80) {
				channels[channel].firstKeyOn = true;
			}
		}
	}
}

class OPL4FrameSanitizerChannel {
	constructor(channel) {
		this.channel = channel;
		this.firstKeyOn = false;
		this.firstKeyOnOutput = false;
		this.waveTableChanged = false;
		this.keyOff = new Register(0x268 + channel);
		this.totalLevelDirect = new Register(0x250 + channel);
		this.waveTableHigh = new Register(0x220 + channel);
	}

	processRegisterWrite(opl4Input, opl4Output, address, value) {
		if (address >= 0x268 && address < 0x280) {
			if (value & 0x10) {
				value = value & 0xE0 | 0x08;  // Use pan -8 to mute instead of CH DO2.
			}
			if (value & 0x80) {
				this.firstKeyOn = true;
			} else {
				this.keyOff.set(this.keyOff.isSet() ? this.keyOff.get() & 0x20 | value : value);
				this.firstKeyOn &&= (value & 0x0F) != 0x08;
			}
		} else if (address >= 0x250 && address < 0x268) {
			if (value & 1) {
				this.totalLevelDirect.set(value);
			}
		} else if (address >= 0x208 && address < 0x220) {
			this.waveTableHigh.set(opl4Input.get(address + 24));
		} else if (address >= 0x220 && address < 0x238) {
			this.waveTableHigh.set(value & 0xFE | this.waveTableHigh.get() & 1);
		}
		opl4Input.set(address, value);
	}

	processFrame(opl4Input, opl4Output) {
		if (opl4Input.isSet(0x208 + this.channel) && opl4Output.isSet(0x208 + this.channel) &&
			opl4Input.getWaveTable(this.channel).equals(opl4Output.getWaveTable(this.channel))) {
			opl4Input.unset(0x208 + this.channel);
		}
		if (this.firstKeyOn) {
			this.waveTableChanged = opl4Input.isSet(0x208 + this.channel);
			if (this.waveTableChanged) {
				this.keyOff.set(this.keyOff.isSet() ? this.keyOff.get() & 0x20 | 0x48 : 0x48);  // Force mute
			}
		}
	}

	emitKeyOff(opl4Input, opl4Output, emit) {
		if (this.firstKeyOnOutput) {
			writeRegisterIfSet(opl4Output, this.keyOff, emit);
		} else {
			this.keyOff.unset();
		}
	}

	emitWaveTable(opl4Input, opl4Output, emit) {
		if (this.firstKeyOn) {
			if (!opl4Output.isSet(0x220 + this.channel) || (opl4Output.get(0x220 + this.channel) & 1) != (this.waveTableHigh.get() & 1)) {
				writeRegisterIfSet(opl4Output, this.waveTableHigh, emit);
			}
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x208 + this.channel), emit);
		}
	}

	emitFrequency(opl4Input, opl4Output, emit) {
		if (this.firstKeyOn) {
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x220 + this.channel), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x238 + this.channel), emit);
		}
	}

	emitTotalLevel(opl4Input, opl4Output, emit) {
		if (this.firstKeyOn) {
			writeRegisterIfSet(opl4Output, this.totalLevelDirect, emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x250 + this.channel), emit);
		} else {
			this.totalLevelDirect.unset();
		}
	}

	emitLFOADSR(opl4Input, opl4Output, emit) {
		if (this.firstKeyOn) {
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x280 + this.channel), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x298 + this.channel), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x2B0 + this.channel), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x2C8 + this.channel), emit);
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x2E0 + this.channel), emit);
		}
	}

	emitKeyOn(opl4Input, opl4Output, emit) {
		if (this.firstKeyOn) {
			writeRegisterIfSet(opl4Output, opl4Input.getRegister(0x268 + this.channel), emit);
			this.firstKeyOnOutput = true;
		}
	}
}

function writeRegisterIfSet(opl4Output, register, emit) {
	if (register.isSet()) {
		if (opl4Output.set(register.address, register.value)) {
			emit(CommandOPL4Register.of(register.address, register.value));
		}
		register.unset();
	}
}
