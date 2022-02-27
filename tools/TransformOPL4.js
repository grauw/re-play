import { Transform } from "./Transform.js";
import { Track } from "./Track.js";
import { CommandJump } from "./Command.js";
import { CommandOPL4Wave, CommandOPL4WaitLoad } from "./CommandOPL4.js";

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
				if (command instanceof CommandOPL4Wave) {
					if (command.register >= 0x08 && command.register < 0x20) {
						if (loadChannels & 1 << command.channel) {
							emitWaitLoad();
						}
						loadChannels |= 1 << command.channel;
					} else if (command.register >= 0x68 && command.register < 0x80 && command.value & 0x80) {
						if (loadChannels & 1 << command.channel) {
							emitWaitLoad();
						}
					} else if (command.register >= 0x80 && command.register < 0xF8) {
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
