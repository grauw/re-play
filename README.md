Re-Play music converter & player
================================

Copyright 2020 Laurens Holst

Project information
-------------------

  * Author: Laurens Holst <laurens@grauw.nl>
  * Source: <https://hg.sr.ht/~grauw/re-play>
  * License: Simplified BSD License

Converts music in VGM format to data streams suitable for play back on MSX
sound chips. The formats aims to be both efficient for playback and small
in size.


System requirements
-------------------

  * MSX, MSX2, MSX2+ or MSX turboR
  * 64K main RAM
  * 16K video RAM
  * MSX-DOS

If the replayer core and music data is embedded in a ROM, the RAM requirement is
lowered to 16K and the MSX-DOS requirement is dropped.


Converter functions
-------------------

The converter has the following functions:

  * Compact data format
  * Simple playback on three sound chips
  * Coalescing instrument settings per channel
  * Grouping into five event types (key, frequency, instrument, wait, loop)
  * Clock frequency conversion
  * Channel remapping
  * Small wait removal
  * Timing quantisation
  * Trimming of leading silence
  * Moving frequency events before key on
  * Volume adjustment

It also outputs VGM files for the YM2151 OPM and YM2610 OPN for easy testing
with VGMPlay and debugging with vgm2txt.


Music data format
-----------------

Re-play files start with a byte indicating the data format, followed by a
command stream with events based on the data format.

Data format `0`: `opn` (OPM / OPNA / OPNB FM) consists of these events:

  * 00-7F: Key on / off event.
           Bit 0-2: channel, bit 3-6: slots.
  * 80-87: Note frequency event.
           Bit 0-2: channel, byte 1-2: OPM frequency, byte 3-4: OPN frequency.
  * 88-8F: Instrument settings.
           Bit 0-2: channel, byte 1-25: slot parameters, byte 26: feedback / algorithm.
  * 90:    Relative jump.
           Byte 1: bank offset, byte 2-3: address offset.
  * 91:    Relative call.
           Byte 1: bank offset, byte 2-3: address offset.
  * 92:    Return.
  * 93-FF: Wait.
           n - 92H: nr. of 60Hz ticks.


Additional notes
----------------

The arcade game music uses two OPNs clocked at 1.5 MHz. But because it sets the
prescaler to a frequency divider of 3 instead of the usual 6, they act like OPNs
clocked at 3 MHz with the default prescaling.

The game sets the frequency after it sets key on. Due to this you sometimes get
a wrong note at the start of a track on real hardware, depending on the initial
values. This was probably a bug in the original game’s replayer code which did
not get exposed during normal play. A processing step was added to put frequency
in front of the key on commands.

Track 01 is the same as Track 27, but with two channels muted. It is recommended
to use track 27 instead of track 01.


Usage instructions
------------------

Put VGM files in the `res/` directory, if they are .vgz files then extract them
to .vgm with gunzip. Add the files to the `resources.json` manifest file in the
`res` directory and set the various settings.

Then, on macOS and Linux execute the `make` command to convert the files and
compile the replayer. Test by putting the MSX-DOS system files in the `bin/`
directory and executing the `make run` command. OpenMSX 0.16.0 or later is
required, it currently only supports the Yamaha SFG sound chip.

On Windows, execute the build commands from the Makefile manually.

Note that the [glass](http://www.grauw.nl/projects/glass/) assembler which is
embedded in the project requires [Java 8](https://adoptopenjdk.net/). To check
your Java version, invoke the `java -version` command.

Additionally, the conversion tools are written in JavaScript for Node.js.
You need to have Node.js and NPM installed.
