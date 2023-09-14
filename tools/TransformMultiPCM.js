import { Transform } from "./Transform.js";
import { Track } from "./Track.js";
import { CommandMultiPCM, CommandMultiPCMConfig, CommandMultiPCMRegister } from "./CommandMultiPCM.js";
import { CommandOPL4Config, CommandOPL4Register, CommandOPL4WaveMemory } from "./CommandOPL4.js";
import { ChipMultiPCM } from "./ChipMultiPCM.js";
import { Memory, Ranges } from "./Memory.js";

const realChannels = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30];

export class TransformMultiPCMReduceChannels extends Transform {
	constructor(maxChannels = 28) {
		super();
		this.maxChannels = maxChannels;
	}

	apply(input) {
		if (this.maxChannels >= 28)
			return input;
		if (!input.hasSetupCommand(command => command instanceof CommandMultiPCMConfig))
			return input;
		const output = Track.new(input);
		const chip = new ChipMultiPCM();
		const channelMap = Array(32).fill(-1);
		const free = realChannels.slice(0, this.maxChannels);
		for (const command of input.commands) {
			chip.writeCommand(command);
			if (command instanceof CommandMultiPCMRegister) {
				const value = command.value;
				const channel = command.channel;
				const register = command.register;
				if (register == 4 && (value & 0x80) == 0x80 && channelMap[channel] == -1) {
					if (!free.length) {
						let lowestVolume = chip.get(0xA0 + channel, 0xFE);
						let lowestChannel = -1;
						for (let channel = 0; channel < channelMap.length; channel++) {
							if (channelMap[channel] != -1 && chip.get(0xA0 + channel, 0xFE) > lowestVolume) {
								lowestVolume = chip.get(0xA0 + channel, 0xFE);
								lowestChannel = channel;
							}
						}
						if (lowestChannel != -1) {
							free.push(channelMap[lowestChannel]);
							channelMap[lowestChannel] = -1;
						}
					}

					if (free.length) {
						const newChannel = free.shift();
						channelMap[channel] = newChannel;
	
						output.addCommand(CommandMultiPCMRegister.of(0x80 + newChannel, 0x00));
						output.addCommand(CommandMultiPCMRegister.of(0x60 + newChannel, chip.get(0x60 + channel)));
						output.addCommand(CommandMultiPCMRegister.of(0x40 + newChannel, chip.get(0x40 + channel)));
						output.addCommand(CommandMultiPCMRegister.of(0x20 + newChannel, chip.get(0x20 + channel)));
						output.addCommand(CommandMultiPCMRegister.of(0xC0 + newChannel, chip.get(0xC0 + channel)));
						output.addCommand(CommandMultiPCMRegister.of(0xE0 + newChannel, chip.get(0xE0 + channel)));
						output.addCommand(CommandMultiPCMRegister.of(0xA0 + newChannel, chip.get(0xA0 + channel)));
					}
				}
				const newChannel = channelMap[channel];
				if (newChannel >= 0) {
					output.addCommand(CommandMultiPCMRegister.of(register << 5 | newChannel, value));
				}

				if (register == 4 && (value & 0x80) == 0x00 && channelMap[channel] != -1) {
					free.push(channelMap[channel]);
					channelMap[channel] = -1;
				}
			} else {
				output.addCommand(command);
			}
		}
		return output;
	}
}

export class TransformMultiPCMToOPL4 extends Transform {
	apply(input) {
		if (!input.hasSetupCommand(command => command instanceof CommandMultiPCMConfig))
			return input;
		const commands = [];
		const chip = new ChipMultiPCM();
		const channelMap = [0, 1, 2, 3, 4, 5, 6, -1, 7, 8, 9, 10, 11, 12, 13, -1, 14, 15, 16, 17, 18, 19, 20, -1, 21, 22, 23, -1, -1, -1, -1, -1];
		const instruments = new Set();
		for (const command of input.commands) {
			chip.writeCommand(command);
			if (command instanceof CommandMultiPCMRegister) {
				const channel = command.channel;
				const register = command.register;
				const opl4Channel = channelMap[channel];
				if (opl4Channel >= 0) {
					if (register == 1) {
						commands.push(CommandOPL4Register.of(0x208 + opl4Channel, chip.get(0x20 + channel)));
						instruments.add(chip.getWaveTableNumber(channel));
					} else if (register == 2 || register == 3) {
						const waveTableHigh = chip.get(0x40 + channel) & 0x01;
						const fnumber = (chip.get(0x60 + channel) << 6 | chip.get(0x40 + channel) >> 2) & 0x3FF;
						const octave = chip.get(0x60 + channel) >> 4;
						commands.push(CommandOPL4Register.of(0x220 + opl4Channel, fnumber << 1 & 0xFE | waveTableHigh));
						commands.push(CommandOPL4Register.of(0x238 + opl4Channel, octave << 4 | fnumber >> 7));
					} else if (register == 0 || register == 4) {
						const pan = chip.get(0x00 + channel) & 0xF0;
						const key = chip.get(0x80 + channel) & 0xF0;
						commands.push(CommandOPL4Register.of(0x268 + opl4Channel, key | pan >> 4));
					} else if (register == 5) {
						commands.push(CommandOPL4Register.of(0x250 + opl4Channel, chip.get(0xA0 + channel)));
					} else if (register == 6) {
						commands.push(CommandOPL4Register.of(0x280 + opl4Channel, chip.get(0xC0 + channel)));
					} else if (register == 7) {
						commands.push(CommandOPL4Register.of(0x2E0 + opl4Channel, chip.get(0xE0 + channel)));
					}
				}
			} else if (!(command instanceof CommandMultiPCM)) {
				commands.push(command);
			}
		}

		const opl4Memory = new Memory(new Uint8Array(0x200000));
		const ranges00 = new Ranges().add(0, 0x100000).intersect(chip.memory.ranges);
		const ranges10 = new Ranges().add(chip.bankLow, chip.bankLow + 0x80000).intersect(chip.memory.ranges);
		const ranges18 = new Ranges().add(chip.bankHigh, chip.bankHigh + 0x80000).intersect(chip.memory.ranges);
		for (const [range, data] of chip.memory.getDataRanges(ranges00)) {
			opl4Memory.setData(range.start, data);
		}
		for (const [range, data] of chip.memory.getDataRanges(ranges10)) {
			opl4Memory.setData(0x100000 + range.start - chip.bankLow, data);
		}
		for (const [range, data] of chip.memory.getDataRanges(ranges18)) {
			opl4Memory.setData(0x180000 + range.start - chip.bankHigh, data);
		}
		for (const instrument of instruments) {
			const address = instrument * 12;
			opl4Memory.set(address, opl4Memory.get(address, 0x80) >> 1 | opl4Memory.get(address, 0x1F));
		}

		const output = Track.new(input);
		output.addCommand(CommandOPL4Config.of(chip.clockFrequency, "ymf278b"));
		output.addCommand(CommandOPL4Register.of(0x105, 0x03));
		output.addCommand(CommandOPL4Register.of(0x202, 0x00));
		for (const [range, data] of opl4Memory.getDataRanges()) {
			output.addCommand(CommandOPL4WaveMemory.of(range.start, data));
		}
		output.addCommands(commands);
		return output;
	}
}
