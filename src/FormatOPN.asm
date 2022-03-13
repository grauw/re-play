;
;
;
	INCLUDE "SFG.asm"
	INCLUDE "Makoto.asm"
	INCLUDE "Neotron.asm"

FormatOPN_ID: equ 0

FormatOPN_Detect:
	call SFG_Detect
	ld hl,SFG_JumpTable
	ret c
	call Makoto_Detect
	ld hl,Makoto_JumpTable
	ret c
	call Neotron_Detect
	ld hl,Neotron_JumpTable
	ret

; Data in RAM
FormatOPN_instruments:
	ds 8 * 2
