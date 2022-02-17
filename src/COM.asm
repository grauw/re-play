;
;
;
BDOS: equ 0005H
JIFFY: equ 0FC9EH

_INNOE: equ 08H
_CONST: equ 0BH
_OPEN: equ 43H
_CLOSE: equ 45H
_READ: equ 48H
_TERM: equ 62H
_DOSVER: equ 6FH

PARAMETERS: equ 80H

SoundData: equ 4000H

	org 100H

	jp Main

	INCLUDE "Player.asm"
	INCLUDE "Memory.asm"

Main:
	call DOS_IsDOS2
	ret c
	ld a,(PARAMETERS)
	cp 2
	ld a,89H  ; .NOPAR Missing parameter
	jp c,DOS_TerminateWithErrorCode
	ld de,PARAMETERS + 2
	ld a,1  ; no write
	ld c,_OPEN
	call BDOS
	jp nz,DOS_TerminateWithErrorCode
	push bc
	ld de,SoundData
	ld hl,4000H
	ld c,_READ
	call BDOS
	jp nz,DOS_TerminateWithErrorCode
	pop bc
	ld c,_CLOSE
	call BDOS
	jp nz,DOS_TerminateWithErrorCode

	ld hl,SoundData
	call Player_Detect
	ld a,1
	jp nc,DOS_TerminateWithErrorCode
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

; a = error code
DOS_TerminateWithErrorCode:
	ld b,a
	ld c,_TERM
	jp BDOS

; f <- c: not DOS 2
DOS_IsDOS2:
	ld c,_DOSVER
	call BDOS
	add a,-1
	ret c
	ld a,b
	cp 2
	ret
