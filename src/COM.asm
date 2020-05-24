;
;
;
BDOS: equ 0005H
FCB1: equ 005CH
JIFFY: equ 0FC9EH

FCB_RECORD_SIZE: equ 0EH
FCB_FILE_SIZE: equ 10H
FCB_RANDOM_RECORD_NUMBER: equ 21H

_INNOE: equ 08H
_CONST: equ 0BH
_FOPEN: equ 0FH
_FCLOSE: equ 10H
_SETDTA: equ 1AH
_RDBLK: equ 27H

SoundData: equ 6000H

	org 100H

	jp Main

	INCLUDE "Player.asm"
	INCLUDE "Memory.asm"

Main:
	ld de,FCB1
	ld c,_FOPEN
	call BDOS
	and a
	ret nz
	ld de,SoundData
	ld c,_SETDTA
	call BDOS
	ld hl,1
	ld (FCB1 + FCB_RECORD_SIZE),hl
	ld hl,0
	ld (FCB1 + FCB_RANDOM_RECORD_NUMBER),hl
	ld (FCB1 + FCB_RANDOM_RECORD_NUMBER + 2),hl
	ld hl,(FCB1 + FCB_FILE_SIZE)
	ld de,FCB1
	ld c,_RDBLK
	call BDOS
	ld de,FCB1
	ld c,_FCLOSE
	call BDOS
	and a
	ret nz
	call Player_Detect
	ld hl,SoundData
	call Player_Play
	ld a,(JIFFY)
	ld c,a
Main_Loop:
	halt
	ld a,(JIFFY)
	ld b,a
	sub c
	jr z,Main_Loop
	ld c,b
	ld b,a
Main_Tick_Loop:
	push bc
	call Player_Tick
	pop bc
	djnz Main_Tick_Loop
	push bc
	ld c,_CONST
	call BDOS
	pop bc
	and a
	jr z,Main_Loop
	push bc
	ld c,_INNOE
	call BDOS
	pop bc
	or 20H  ; lower-case
	cp "p"
	jr nz,Main_End
Main_Pause:
	push bc
	call Player_TogglePause
	pop bc
	jr Main_Loop
Main_End:
	call Player_Stop
	ret
