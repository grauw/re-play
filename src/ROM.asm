;
;
;
WRTVDP: equ 0047H
INITXT: equ 006CH
CHSNS: equ 009CH
CHGET: equ 009FH
CHPUT: equ 00A2H
CLIKSW: equ 0F3DBH
JIFFY: equ 0FC9EH
RG9SAV: equ 0FFE8H

RePlayer_SetBank_M: MACRO
;	ld (6000H),a  ; Konami4 6000H-7FFFH
;	ld (7000H),a  ; Konami5 6000H-7FFFH
;	ld (6800H),a  ; ASCII8  6000H-7FFFH
	ld (7000H),a  ; ASCII16 8000H-BFFFH
	ENDM

RAM_ORG: equ 0C000H
RAM_SIZE: equ 400H

	org 4000H

	db "AB"
	dw Main
	dw 0, 0, 0, 0, 0, 0

RAM: ds RAM_SIZE

	SECTION RAM

	org RAM_ORG

	ENDS

	INCLUDE "RePlayer.asm"
	INCLUDE "Utils.asm"
	INCLUDE "Memory.asm"

Main:
	ei
	ld h,40H
	call Memory_GetSlot
	ld h,80H
	call Memory_SetSlot
	ld hl,RAM
	ld de,RAM_ORG
	ld bc,RAM_SIZE
	ldir
	call INITXT
	ld a,0
	ld (CLIKSW),a
	ld hl,Main_message
	call Main_PrintString

	ld a,1
	ld (RePlayer_currentBank),a
	RePlayer_SetBank_M
	ld a,(SoundData)
	call RePlayer_Detect
Main_Play:
	call RePlayer_Stop
	call Main_WaitFrame
	ld bc,(Main_currentTrack)
	ld a,1
	ld hl,SoundData + 1
	call RePlayer_Play
	call RePlayer_Tick
Main_Loop:
	call Main_WaitFrame
	call RePlayer_Tick
	call CHSNS
	jr z,Main_Loop
	call CHGET
	or 20H  ; lower-case
	cp "p"
	jr z,Main_Pause
	cp "n"
	jr z,Main_Next
	cp "b"
	jr z,Main_Previous
	cp "r"
	jr z,Main_Play
	cp "f"
	jr z,Main_ToggleFrequency
	jr Main_End
Main_Pause:
	call RePlayer_TogglePause
	jr Main_Loop
Main_Next:
	call RePlayer_Stop
	ld bc,(Main_currentTrack)
	inc bc
	ld (Main_currentTrack),bc
	jp Main_Play
Main_Previous:
	call RePlayer_Stop
	ld bc,(Main_currentTrack)
	dec bc
	ld (Main_currentTrack),bc
	jp Main_Play
Main_ToggleFrequency:
	ld a,(RG9SAV)
	xor 00000010B
	ld (RG9SAV),a
	ld b,a
	ld c,9
	call WRTVDP
	jp Main_Loop
Main_End:
	call RePlayer_Stop
	ret

Main_WaitFrame:
	ld a,(JIFFY)
	ld c,a
Main_WaitFrame_Loop:
	halt
	ld a,(JIFFY)
	cp c
	jr z,Main_WaitFrame_Loop
	ret

; hl = string (0-terminated)
Main_PrintString:
	ld a,(hl)
	and a
	ret z
	inc hl
	call CHPUT
	jr Main_PrintString

Main_message:
	db "Re-play",13,10,10
	db "N - Next track",13,10
	db "B - Previous track",13,10
	db "R - Restart track",13,10
	db "P - Toggle pause",13,10
	db "F - Toggle frequency",13,10,0

	SECTION RAM

; Data in RAM
Main_currentTrack:
	dw 0

	ENDS

	ds 8000H - $

SoundData:
	INCBIN "rom.rep"

	ds -$ & 0x3FFF  ; pad
