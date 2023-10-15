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
	add a,a
	jr nc,FormatOPLLPSG_ProcessR800_WriteBlock
	jp z,FormatOPLLPSG_ProcessR800_Call
	sub 82H << 1
	jp c,FormatOPLLPSG_ProcessR800_Return
	jp z,FormatOPLLPSG_ProcessR800_Jump
	rrca
	ret
FormatOPLLPSG_ProcessR800_WriteBlock:
	jp p,MSXMusic_WriteBlockR800
	call PSG_WriteBlock
	jp FormatOPLLPSG_ProcessR800
FormatOPLLPSG_ProcessR800_Call:
	RePlayer_Call_M
	jp FormatOPLLPSG_ProcessR800
FormatOPLLPSG_ProcessR800_Return:
	RePlayer_Return_M
	jp FormatOPLLPSG_ProcessR800
FormatOPLLPSG_ProcessR800_Jump:
	RePlayer_Jump_M
	jp FormatOPLLPSG_ProcessR800

; hl = sound data
; ix = stack pointer
; a <- wait amount
FormatOPLLPSG_ProcessZ80:
	ld a,(hl)
	inc hl
	add a,a
	jr nc,FormatOPLLPSG_ProcessZ80_WriteBlock
	jp z,FormatOPLLPSG_ProcessZ80_Call
	sub 82H << 1
	jp c,FormatOPLLPSG_ProcessZ80_Return
	jp z,FormatOPLLPSG_ProcessZ80_Jump
	rrca
	ret
FormatOPLLPSG_ProcessZ80_WriteBlock:
	jp p,MSXMusic_WriteBlockZ80
	call PSG_WriteBlock
	jp FormatOPLLPSG_ProcessZ80
FormatOPLLPSG_ProcessZ80_Call:
	RePlayer_Call_M
	jp FormatOPLLPSG_ProcessZ80
FormatOPLLPSG_ProcessZ80_Return:
	RePlayer_Return_M
	jp FormatOPLLPSG_ProcessZ80
FormatOPLLPSG_ProcessZ80_Jump:
	RePlayer_Jump_M
	jp FormatOPLLPSG_ProcessZ80

; hl = sound data
; ix = stack pointer
; a <- wait amount
FormatOPLLPSG_ProcessPSG:
	ld a,(hl)
	inc hl
	add a,a
	jr nc,FormatOPLLPSG_ProcessPSG_WriteBlock
	jp z,FormatOPLLPSG_ProcessPSG_Call
	sub 82H << 1
	jp c,FormatOPLLPSG_ProcessPSG_Return
	jp z,FormatOPLLPSG_ProcessPSG_Jump
	rrca
	ret
FormatOPLLPSG_ProcessPSG_WriteBlock:
	jp p,FormatOPLLPSG_SkipBlock
	call PSG_WriteBlock
	jp FormatOPLLPSG_ProcessPSG
FormatOPLLPSG_ProcessPSG_Call:
	RePlayer_Call_M
	jp FormatOPLLPSG_ProcessPSG
FormatOPLLPSG_ProcessPSG_Return:
	RePlayer_Return_M
	jp FormatOPLLPSG_ProcessPSG
FormatOPLLPSG_ProcessPSG_Jump:
	RePlayer_Jump_M
	jp FormatOPLLPSG_ProcessPSG

; a = count * 2 - 2
; hl = sound data
FormatOPLLPSG_SkipBlock:
	add a,02H
	ld c,a
	ld b,0
	add hl,bc
	jp FormatOPLLPSG_ProcessPSG

FormatOPLLPSG_Mute:
	call MSXMusic_Mute
	jp PSG_Mute

FormatOPLLPSG_Restore:
	call MSXMusic_Restore
	jp PSG_Restore
