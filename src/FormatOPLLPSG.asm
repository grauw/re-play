;
;
;
	INCLUDE "MSXMusic.asm"
	INCLUDE "PSG.asm"

FormatOPLLPSG_ID: equ 2

FormatOPLLPSG_Detect:
	call MSXMusic_Detect
	ld hl,FormatOPLLPSG_JumpTablePSG
	ccf
	ret c
	call Utils_IsR800
	ld hl,FormatOPLLPSG_JumpTableR800
	ret c
	ld hl,FormatOPLLPSG_JumpTableZ80
	scf
	ret

FormatOPLLPSG_JumpTableR800:
	jp FormatOPLLPSG_ProcessR800
	jp FormatOPLLPSG_Mute
	jp FormatOPLLPSG_Restore

FormatOPLLPSG_JumpTableZ80:
	jp FormatOPLLPSG_ProcessZ80
	jp FormatOPLLPSG_Mute
	jp FormatOPLLPSG_Restore

FormatOPLLPSG_JumpTablePSG:
	jp FormatOPLLPSG_ProcessPSG
	jp PSG_Mute
	jp PSG_Restore

; hl = sound data
; ix = stack pointer
; a <- wait amount
FormatOPLLPSG_ProcessR800:
	ld a,(hl)
	inc hl
	call FormatOPLLPSG_ProcessR800_Dispatch
	jr FormatOPLLPSG_ProcessR800
FormatOPLLPSG_ProcessR800_Dispatch:
	cp 40H
	jp c,MSXMusic_WriteBlockR800
	cp 80H
	jp c,PSG_WriteBlock
	jp z,Player_Jump
	sub 82H
	jp c,Player_Call
	jp z,Player_Return
	pop bc
	ret

; hl = sound data
; ix = stack pointer
; a <- wait amount
FormatOPLLPSG_ProcessZ80:
	ld a,(hl)
	inc hl
	call FormatOPLLPSG_ProcessZ80_Dispatch
	jr FormatOPLLPSG_ProcessZ80
FormatOPLLPSG_ProcessZ80_Dispatch:
	cp 40H
	jp c,MSXMusic_WriteBlockZ80
	cp 80H
	jp c,PSG_WriteBlock
	jp z,Player_Jump
	sub 82H
	jp c,Player_Call
	jp z,Player_Return
	pop bc
	ret

; hl = sound data
; ix = stack pointer
; a <- wait amount
FormatOPLLPSG_ProcessPSG:
	ld a,(hl)
	inc hl
	call FormatOPLLPSG_ProcessPSG_Dispatch
	jr FormatOPLLPSG_ProcessPSG
FormatOPLLPSG_ProcessPSG_Dispatch:
	cp 40H
	jr c,FormatOPLLPSG_SkipBlock
	cp 80H
	jp c,PSG_WriteBlock
	jp z,Player_Jump
	sub 82H
	jp c,Player_Call
	jp z,Player_Return
	pop bc
	ret

; a = count - 1
; hl = sound data
FormatOPLLPSG_SkipBlock:
	inc a
	add a,a
	ld c,a
	ld b,0
	add hl,bc
	ret

FormatOPLLPSG_Mute:
	call MSXMusic_Mute
	jp PSG_Mute

FormatOPLLPSG_Restore:
	call MSXMusic_Restore
	jp PSG_Restore
