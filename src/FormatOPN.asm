;
;
;
	INCLUDE "SFG.asm"
	INCLUDE "Makoto.asm"
	INCLUDE "Neotron.asm"

FormatOPN_ID: equ 0

FormatOPN_Detect:
	call SFG_Detect
	ld bc,SFG_Process
	ld de,SFG_Mute
	ld hl,SFG_Restore
	ret c
	call Makoto_Detect
	ld bc,Makoto_Process
	ld de,Makoto_Mute
	ld hl,Makoto_Restore
	ret c
	call Neotron_Detect
	ld bc,Neotron_Process
	ld de,Neotron_Mute
	ld hl,Neotron_Restore
	ret

; Data in RAM
FormatOPN_instruments:
	ds 8 * 2
