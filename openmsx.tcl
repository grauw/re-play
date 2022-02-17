# source lib/neonlib/tools/symbols.tcl
# source lib/neonlib/tools/profile.tcl

# symbols::load bin/re-play.sym

ext debugdevice
set debugoutput stdout
debug set_watchpoint read_io 0x2E
# debug set_watchpoint write_mem 0x0000 {([debug read ioports 0xA8] & 0x0C) == 0x04}
# debug set_watchpoint read_mem 0x0000 {([debug read ioports 0xA8] & 0x0C) == 0x04}

diskmanipulator create /tmp/re-play.dsk 32M
virtual_drive /tmp/re-play.dsk
diskmanipulator format virtual_drive
diskmanipulator import virtual_drive bin/
virtual_drive eject
hda /tmp/re-play.dsk

set maxframeskip 100
set throttle off
after time 11 "set throttle on"
