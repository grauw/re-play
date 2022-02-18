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

Mapper_GetBank: equ DOS2Mapper_GetBank
Mapper_SetBank: equ DOS2Mapper_SetBank

	org 100H

	jp Main

	INCLUDE "Player.asm"
	INCLUDE "Memory.asm"
	INCLUDE "DOS2Mapper.asm"

Main:
	call DOS_IsDOS2
	ret c
	call DOS2Mapper_Initialize

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
	ld hl,8000H
	ld c,_READ
	call BDOS
	jp nz,DOS_TerminateWithErrorCode
	bit 7,h
	jp z,Main_ReadComplete
Main_ReadLoop:
	call DOS2Mapper_Allocate
	push af
	ld a,0DEH  ; .NORAM Not enough memory
	jp c,DOS_TerminateWithErrorCode
	pop af
	call DOS2Mapper_SetBank
	pop bc
	push bc
	ld de,Main_loadBuffer
	ld hl,1000H
	ld c,_READ
	call BDOS
	jp nz,Main_ReadContinue
	exx
	ld hl,Main_loadBuffer
	ld de,SoundData
	ld bc,1000H
	ldir
	exx
	pop bc
	push bc
	ld de,Main_loadBuffer
	ld hl,1000H
	ld c,_READ
	call BDOS
	jp nz,Main_ReadContinue
	exx
	ld hl,Main_loadBuffer
	ld de,SoundData + 1000H
	ld bc,1000H
	ldir
	exx
	pop bc
	push bc
	ld de,Main_loadBuffer
	ld hl,1000H
	ld c,_READ
	call BDOS
	jp nz,Main_ReadContinue
	exx
	ld hl,Main_loadBuffer
	ld de,SoundData + 2000H
	ld bc,1000H
	ldir
	exx
	pop bc
	push bc
	ld de,Main_loadBuffer
	ld hl,1000H
	ld c,_READ
	call BDOS
	jp nz,Main_ReadContinue
	exx
	ld hl,Main_loadBuffer
	ld de,SoundData + 3000H
	ld bc,1000H
	ldir
	exx
Main_ReadContinue:
	push af
	push hl
	ld a,0
	call DOS2Mapper_SetBank
	pop hl
	pop af
	cp 0C7H  ; .EOF End of file
	jp z,Main_ReadComplete
	and a
	jp nz,DOS_TerminateWithErrorCode
	bit 4,h
	jp nz,Main_ReadLoop
Main_ReadComplete:
	pop bc
	ld c,_CLOSE
	call BDOS
	jp nz,DOS_TerminateWithErrorCode

	ld hl,SoundData
	call Player_Detect
	ld a,1
	jp nc,DOS_TerminateWithErrorCode
	ld a,0
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

; Data in RAM
Main_loadBuffer:
	ds 1000H
