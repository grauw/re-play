# Re-Play music converter & player

Copyright 2020 Laurens Holst

## Project information

  * Author: Laurens Holst <laurens@grauw.nl>
  * Source: <https://hg.sr.ht/~grauw/re-play>
  * Support: <https://msx.org/forum/msx-talk/graphics-and-music/re-play-music-converter-player>
  * License: MIT

Converts music in VGM format to a stream of register writes suitable for play
back on MSX sound chips, and provides replayer code for MSX.

Streams of register writes are efficient to play back, and flexible to author
music for since almost any source or tool can be used as long as a VGM recording
can be obtained. The weakness is the size of the data, which needs to be
carefully optimised. It is most suitable for use in MegaROM software.

The format also supports compression using the grammar compression technique,
which extracts repetition in the command stream to subsequences that can be
called in multiple places. It can decode straight from ROM as it is playing,
and does not need extra RAM apart from some space to keep track of a stack.

In addition to the currently supported sound chips, this project intends to
provide a framework to support more sound chips and specialised formats for
future projects, which will be implemented as needed.

## System requirements

  * MSX, MSX2, MSX2+ or MSX turboR
  * 16K main RAM
  * 16K video RAM
  * MegaROM cartridge

The above requirements are for the MegaROM version of the player. An MSX-DOS2
player is also provided, which additionally requires as much RAM as is needed to
fit the music files in memory.

# OPN format (OPM / OPNA / OPNB FM)

Re-Play’s `opn` format was created to play the original arcade music of
Ghosts n’ Goblins (Makaimura in Japanese) in ASM’s 2020 MSX remake, using either
the Yamaha SFG (OPM), Neotron (OPNB) or Makoto (OPNA) sound cartridges. Since
the original arcade game uses two OPNs clocked at 1.5 MHz, this involves
converting the music data to different clock frequencies, as well as three
similar but different sound chip architectures.

Although the player is not slow, the primary focus of this format is the
reduction of the music data size, as well as the support of multiple sound
chips. The total music data size is about 64K.

Since the format is optimised for the structure of GnG’s music data, it
currently does not work as well for other OPN music where the output sizes can
become quite large as a result.

## OPN format converter features

  * Triple sound chip support (OPM, OPNA, OPNB)
  * Compact data format
  * Timing quantisation
  * Clock frequency conversion
  * Coalescing instrument settings per channel
  * Grouping into five event types (key, frequency, instrument, wait, loop)
  * Moving frequency events before key on
  * Channel remapping
  * Volume adjustment

Note: Ghosts n’ Goblins sets the frequency after it sets key on. Due to this you
sometimes get a wrong note at the start of a track on real hardware, depending
on the initial values. This was probably a bug in the original game’s replayer
code which did not get exposed during normal play. A transform was added to put
frequency in front of the key on commands.

## OPN format specification

Re-play `.rep` files start with a byte indicating the data format, followed by
a command stream with events based on the data format.

Format ID: `0`

  * `00-7F`: Key on / off.
             Bit 0..2: channel. Bit 3..6: slots.
  * `80-87`: Note frequency.
             Bit 0..2: channel. Byte 1..2: OPM frequency. Byte 3..4: OPN frequency.
  * `88-8F`: Instrument settings.
             Bit 0..2: channel. Byte 1..25: slot parameters. Byte 26: feedback / algorithm.
  * `90`:    Relative call.
             Byte 1..2: address offset. Byte 3: bank offset.
  * `91`:    Return.
  * `92`:    Relative jump.
             Byte 1..2: address offset. Byte 3: bank offset.
  * `93-FF`: Wait.
             Byte 0: tick count - 92H.

# OPL4 format (MoonSound)

Re-Play’s `opl4` format is created for an unannounced project which needed a
fast OPL4 player. The focus for this format therefore is playback speed. It
achieves this by aggressively optimising away register writes which can be
avoided, reordering writes such that slow wave table loads rarely need to be
awaited, and outputting in a fast unrolled loop. Nevertheless, the file sizes
are quite respectable.

The format supports both FM and WAVE, and has options to either include samples
in the data or to preload wavekits externally (which can then be compressed).

## OPL4 format converter features

  * FM and WAVE support
    * FM source from OPL4, OPL3, OPL2 and OPL
    * WAVE source from OPL4 and MultiPCM
  * Fast playback
  * Compact data format
  * Timing quantisation
  * Aggressive optimisation of register writes
  * Custom wave table generation
  * Channel remapping
  * Volume adjustment (WAVE and 2-op FM)

## OPL4 format specification

Re-play `.rep` files start with a byte indicating the data format, followed by
a command stream with events based on the data format.

Format ID: `1`

  * `00-3F`: OPL4 FM1 register write block.
             Byte 0: count n - 1 + 00H. Bytes 1..2n+1: address, value sequence.
  * `40-7F`: OPL4 FM2 register write block.
             Byte 0: count n - 1 + 40H. Bytes 1..2n+1: address, value sequence.
  * `80-BF`: OPL4 WAVE register write block.
             Byte 0: count n - 1 + 80H. Bytes 1..2n+1: address, value sequence.
  * `C0`:    Relative call.
             Byte 1..2: address offset. Byte 3: bank offset.
  * `C1`:    Return.
  * `C2`:    Relative jump.
             Byte 1..2: address offset. Byte 3: bank offset.
  * `C3`:    Wait for OPL4 WAVE load.
  * `C4`:    OPL4 WAVE memory write block.
             Bytes 1..2: length. Bytes 3..n+3: value sequence.
  * `C5-FF`: Wait.
             Byte 0: tick count - C4H.

# OPLL-PSG format (MSX-MUSIC + PSG)

Re-Play’s `opll-psg` format is created for projects which need a fast MSX-MUSIC
and/or PSG player. The focus for this format therefore is playback speed, but
data size is also important.

## OPLL-PSG format converter features

  * OPLL support
  * PSG support
  * Fast playback
  * Compact data format
  * Timing quantisation
  * Aggressive optimisation of register writes
  * Channel remapping (OPLL only)
  * Volume adjustment

## OPLL-PSG format specification

Re-play `.rep` files start with a byte indicating the data format, followed by
a command stream with events based on the data format.

Format ID: `2`

  * `00-3F`: OPLL register write block.
             Byte 0: count n - 1 + 00H. Bytes 1..2n+1: address, value sequence.
  * `40-7F`: PSG register write block.
             Byte 0: count n - 1 + 40H. Bytes 1..2n+1: address, value sequence.
  * `80`:    Relative call.
             Byte 1..2: address offset. Byte 3: bank offset.
  * `81`:    Return.
  * `82`:    Relative jump.
             Byte 1..2: address offset. Byte 3: bank offset.
  * `83-FF`: Wait.
             Byte 0: tick count - 82H.

# Other formats

Use the `text` format to generate a textual description of the command data
output, similar to `vgm2txt`. Useful for analysis and debugging.

Use the `vgm-opm`, `vgm-opnb` or `vgm-opl4` formats to generate VGM files for
the specified chip, useful for testing optimisations with VGMPlay on PC.

# Resource manifests

The converter is instructed what to do by a resource manifest. For examples,
see the resources.json manifests in the `res` directory.

The top level object supports the following key / values:

  * `format`:
    Format identifier.
    One of `opn`, `opl4`, `opll-psg`, `text`, `text-opn`, `text-opl4`,
    `text-opll-psg`, `vgm-opm`, `vgm-opnb`, `vgm-opl4`.
  * `bankSize`:
    Player bank size.
    Typically `16384` (16K) or `8192` (8K).
  * `tracks`:
    List of tracks to include.

The following key / values must be set on a per-track basis:

  * `path`:
    VGM source file path.

The following key / values can be set either globally or on a per-track basis:

  * `tickFrequency`:
    Native tick frequency of the original music in Hz, e.g. `50` or `60` Hz.
    If the VGM data contains OPL4 timer I/O, can be set to `opl4-timer`.
    Default: `60`.
  * `targetTickFrequency`:
    Override target tick frequency in case it is different from the native
    tick frequency.
  * `waitThreshold`:
    Waits under this threshold are removed. Specified in ticks of 44100 Hz.
    Default: `0`.
  * `tolerance`:
    Tick frequency matching tolerance, to improve quantisation synchronisation.
    Only use when there is an exact tick frequency match.
    Default: `0`. Range: `0` to `0.5`.
  * `channelMapping`:
    A list of channels and their new channel assignments.
    Specify -1 to remove a channel.
  * `fmChannelMapping`:
    See above, for the FM in the OPL4 format.
  * `psgChannelMapping`:
    See above, for the PSG in the OPLL-PSG format.
  * `attenuation`:
    A volume attenuation specified in dB. Use negative values.
    Default: `0`.
  * `fmAttenuation`:
    See above, optional separate control for FM in the OPL4 format.
  * `waveAttenuation`:
    See above, optional separate control for WAVE in the OPL4 format.
  * `strip`:
    Whether to strip OPL4 WAVE table, sample, and/or music data completely.
    List of identifiers. Default: `[]`.
    * `table`   - Strip wave table.
    * `samples` - Strip sample data.
    * `music`   - Strip music data.
  * `stripMode`:
    Whether to strip specific OPL4 WAVE data.
    Default: `unused`.
    * `none`      - Keep all waves.
    * `unused`    - Strip unused waves.
    * `undefined` - Strip undefined waves (start = end = 0).
    * `coalesce`  - Coalesce used waves to contiguous regions.
    * `all`       - Strip all waves.
  * `stripPadding`:
    Amount of OPL4 WAVE padding samples to include after sample end.
    Default: `4`.
  * `stripMargin`:
    Combine OPL4 WAVE memory blocks when they are within this distance margin.
    Default: `8`.
  * `reduceChannels`:
    Dynamically remaps channels to target amount. Only for MultiPCM source.
    Default: `28`.
  * `stackCapacity`:
    Stack capacity to take into account when validating. Default: `128`.
  * `compress`:
    Compress the command stream (with options object). Default: `false`.
    Options: `minimumLength` minimum length to consider for compression.
  * `initFrame`:
    Perform initialisation in the first frame.
    Default: `true`.
  * `initKeyOff`:
    Emits key-off before first key-on.
    Default: `false`.

Resource keys can be overridden from the command line with `--set key value`.

# Usage instructions

Put VGM or VGZ files in a project specific directory in `res/` directory. Create
a `resources.json` manifest file in the same directory and configure it for your
project. Lastly, modify the `Makefile` so that it builds your files. The default
Makefile is set up for a couple of test soundtracks whose VGM files can be found
on VGMRips.

Then, on macOS and Linux execute the `make` command to convert the files and
compile the replayer. Test by putting the MSX-DOS2 system files in the `bin/`
directory and executing the `make run` command to run the MSX-DOS2 player.
Execute `make run2` to run the MegaROM player. OpenMSX 0.18.0 or later is
recommended.

On Windows, execute the build commands from the Makefile manually.

Note that the [glass](http://www.grauw.nl/projects/glass/) assembler which is
embedded in the project requires [Java 8](https://adoptopenjdk.net/). To check
your Java version, invoke the `java -version` command.

Additionally, the conversion tools are written in JavaScript for Node.js.
You need to have Node.js and NPM installed, and invoke `npm install` in the
project directory before use to install dependencies.
