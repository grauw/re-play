import { ChipOPN } from "./ChipOPN.ts";
import { CommandLabel } from "./Command.ts";
import { CommandFMFrequency, CommandFMInstrument, CommandFMKey } from "./CommandFM.ts";
import { CommandOPNConfig, CommandOPNRegister } from "./CommandOPN.ts";
import { Track } from "./Track.ts";
import { Transform } from "./Transform.ts";

export class TransformOPNToGenericFM extends Transform {
	apply(input: Track) {
		if (!input.hasSetupCommand(command => command instanceof CommandOPNConfig))
			return input;
		const output = Track.new(input);
		const opn = new ChipOPN();
		for (const command of input.commands) {
			if (command instanceof CommandOPNRegister) {
				if (opn.set(command.address, command.value)) {
					const addressLow = command.address & 0xFF;
					if (command.address == 0x028) {
						output.addCommand(CommandFMKey.of(command.value & 7, command.value >> 4));
					} else if (addressLow >= 0xA0 && addressLow < 0xA4) {
						const value = opn.get(command.address + 4) << 8 | opn.get(command.address);
						output.addCommand(CommandFMFrequency.ofFNum(command.channel, (value & 0x7FF) << (value >> 11), opn.getFMClockFrequency()));
					} else if (addressLow >= 0x30 && addressLow < 0x90 || addressLow >= 0xB0 && addressLow < 0xB4) {
						const offset = command.channel >> 2 << 8 | command.channel & 3;
						output.addCommand(CommandFMInstrument.of(command.channel,
							opn.get(0x30 + offset), opn.get(0x34 + offset), opn.get(0x38 + offset), opn.get(0x3C + offset),
							opn.get(0x40 + offset), opn.get(0x44 + offset), opn.get(0x48 + offset), opn.get(0x4C + offset),
							opn.get(0x50 + offset), opn.get(0x54 + offset), opn.get(0x58 + offset), opn.get(0x5C + offset),
							opn.get(0x60 + offset), opn.get(0x64 + offset), opn.get(0x68 + offset), opn.get(0x6C + offset),
							opn.get(0x70 + offset), opn.get(0x74 + offset), opn.get(0x78 + offset), opn.get(0x7C + offset),
							opn.get(0x80 + offset), opn.get(0x84 + offset), opn.get(0x88 + offset), opn.get(0x8C + offset),
							opn.get(0xB0 + offset) | 0xC0
						));
					} else if (addressLow >= 0x90 && addressLow < 0xA0 && command.value & 0x08) {
						throw new Error("SSG-EG not supported.");
					} else if (addressLow == 0x27 && command.value & 0xC0) {
						throw new Error("CSM or 3ch modes not supported.");
					}
				}
				continue;
			} else if (command instanceof CommandOPNConfig) {
				opn.writeCommand(command);
			} else if (command instanceof CommandLabel && input.isLoopLabel(command)) {
				opn.unsetAll(~0);
			}
			output.addCommand(command);
		}
		return output;
	}
}
