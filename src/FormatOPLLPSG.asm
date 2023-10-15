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
	add a,a
	jr nc,FormatOPLLPSG_ProcessR800_WriteBlock
	jp z,FormatOPLLPSG_Jump
	sub 82H << 1
	jp c,FormatOPLLPSG_Call
	jp z,FormatOPLLPSG_Return
	rrca
	pop bc
	ret
FormatOPLLPSG_ProcessR800_WriteBlock:
	jp p,MSXMusic_WriteBlockR800
	jp PSG_WriteBlock

; hl = sound data
; ix = stack pointer
; a <- wait amount
FormatOPLLPSG_ProcessZ80:
	ld bc,FormatOPLLPSG_ProcessZ80
	push bc
	ld a,(hl)
	inc hl
	add a,a
	jr nc,FormatOPLLPSG_ProcessZ80_WriteBlock
	jp z,FormatOPLLPSG_Jump
	sub 82H << 1
	jp c,FormatOPLLPSG_Call
	jp z,FormatOPLLPSG_Return
	rrca
	pop bc
	ret
FormatOPLLPSG_ProcessZ80_WriteBlock:
	jp p,MSXMusic_WriteBlockZ80
	jp PSG_WriteBlock

; hl = sound data
; ix = stack pointer
; a <- wait amount
FormatOPLLPSG_ProcessPSG:
	ld bc,FormatOPLLPSG_ProcessPSG
	push bc
	ld a,(hl)
	inc hl
	add a,a
	jr nc,FormatOPLLPSG_ProcessPSG_WriteBlock
	jp z,FormatOPLLPSG_Jump
	sub 82H << 1
	jp c,FormatOPLLPSG_Call
	jp z,FormatOPLLPSG_Return
	rrca
	pop bc
	ret
FormatOPLLPSG_ProcessPSG_WriteBlock:
	jp p,FormatOPLLPSG_SkipBlock
	jp PSG_WriteBlock

; a = count * 2 - 2
; hl = sound data
FormatOPLLPSG_SkipBlock:
	add a,02H
	ld c,a
	ld b,0
	add hl,bc
	ret

; hl = sound data
FormatOPLLPSG_Jump:
	Player_Jump_M
	ret

; hl = sound data
; ix = stack pointer
FormatOPLLPSG_Call:
	Player_Call_M
	ret

; hl = sound data
; ix = stack pointer
FormatOPLLPSG_Return:
	Player_Return_M
	ret

FormatOPLLPSG_Mute:
	call MSXMusic_Mute
	jp PSG_Mute

FormatOPLLPSG_Restore:
	call MSXMusic_Restore
	jp PSG_Restore
