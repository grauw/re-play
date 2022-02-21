;
;
;
	INCLUDE "MoonSound.asm"

FormatOPL4Wave_ID: equ 1

FormatOPL4Wave_Detect:
	call MoonSound_Detect
	ld bc,MoonSound_Process
	ld de,MoonSound_Mute
	ld hl,MoonSound_Restore
	ret
