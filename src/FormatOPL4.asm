;
;
;
	INCLUDE "MoonSound.asm"
	INCLUDE "MoonSoundZ80.asm"

FormatOPL4_ID: equ 1

FormatOPL4_Detect:
	call MoonSoundZ80_Detect
	ld hl,MoonSoundZ80_JumpTable
	ret c
	call MoonSound_Detect
	ld hl,MoonSound_JumpTable
	ret
