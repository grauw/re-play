;
;
;
	INCLUDE "MoonSound.asm"

FormatOPL4Wave_ID: equ 1

FormatOPL4Wave_Detect:
	call MoonSound_Detect
	ld hl,MoonSound_JumpTable
	ret
