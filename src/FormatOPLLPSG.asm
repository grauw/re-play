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
	ld bc,FormatOPLLPSG_ProcessR800
	push bc
	ld a,(hl)
	inc hl
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
	ld bc,FormatOPLLPSG_ProcessZ80
	push bc
	ld a,(hl)
	inc hl
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
	ld bc,FormatOPLLPSG_ProcessPSG
	push bc
	ld a,(hl)
	inc hl
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
