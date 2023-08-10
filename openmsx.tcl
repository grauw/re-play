source lib/neonlib/tools/symbols.tcl
source lib/neonlib/tools/profile.tcl

debug set_watchpoint read_io 0x2E

variable rom [string match -nocase "*.rom" [carta]];

if {$rom} {
	symbols::load gen/re-play.rom.sym
} else {
	symbols::load gen/re-play.com.sym
}

if {!$rom} {
	diskmanipulator create /tmp/re-play.dsk 32M
	virtual_drive /tmp/re-play.dsk
	diskmanipulator format virtual_drive
	diskmanipulator import virtual_drive bin/
	virtual_drive eject
	hda /tmp/re-play.dsk
}

proc is_my_program {} {
	variable rom
	return [expr ($rom ? [peek16 0x4002] : [peek16 0x101]) == [symbol Main]]
}

debug set_bp -once [symbol Main] {[is_my_program]} {
	set throttle on

	profile::section_scope_bp frame [symbol Player_Tick] {[is_my_program]}
	profile::section_scope_bp process [symbol Player_Process] {[is_my_program]}

	debug set_bp [symbol Player_Play] {[is_my_program]} {
		variable ticks -1
	}

	debug set_bp [symbol Player_Tick] {[is_my_program]} {
		variable ticks
		if {$ticks >= 0} {
			set cycles [profile::to_cycles [dict get $profile::sections process frame_time]]
			if {$cycles >= 3000} {
				set cpu [get_active_cpu]
				set scanlines [expr $cycles * 3579545.0 / [machine_info ${cpu}_freq] / 228]
				puts "Tick $ticks, Cycles: $cycles, Scanlines: [format %.1f $scanlines]"
			}
		}
		incr ticks
	}
}

profile_osd t
set maxframeskip 100
set throttle off
