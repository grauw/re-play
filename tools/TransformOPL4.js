import { Transform } from "./Transform.js";
import { Track } from "./Track.js";
import { CommandJump } from "./Command.js";
import { CommandOPL4Register, CommandOPL4WaitLoad } from "./CommandOPL4.js";

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
