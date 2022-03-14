;
;
;
	INCLUDE "MoonSound.asm"

FormatOPL4_ID: equ 1

FormatOPL4_Detect:
	call MoonSound_Detect
	ld hl,MoonSound_JumpTable
	ret
