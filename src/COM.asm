;
;
;
BDOS: equ 0005H
WRTVDP: equ 0047H
JIFFY: equ 0FC9EH
RG9SAV: equ 0FFE8H

_CONOUT: equ 02H
_INNOE: equ 08H
_STROUT: equ 09H
_CONST: equ 0BH
_OPEN: equ 43H
_CLOSE: equ 45H
_READ: equ 48H
_TERM: equ 62H
_DOSVER: equ 6FH

PARAMETERS: equ 80H

SoundData: equ 4000H

RePlayer_SetBank_M: MACRO
	call DOS2Mapper_SetBank  ; DOS2 8000H-BFFFH
	ENDM

	org 100H

	jp Main

RAM: ds 400H

	INCLUDE "RePlayer.asm"
	INCLUDE "Utils.asm"
	INCLUDE "Memory.asm"
	INCLUDE "DOS2Mapper.asm"

Main:
	call DOS_IsDOS2
	ret c
	call DOS2Mapper_Initialize
	ld de,Main_message
	ld c,_STROUT
	call BDOS

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

	ld a,0
	ld (RePlayer_currentBank),a
	RePlayer_SetBank_M
	ld a,(SoundData)
	call RePlayer_Detect
	ld a,1
	jp nc,DOS_TerminateWithErrorCode
Main_Play:
	call RePlayer_Stop
	call Main_WaitFrame
	ld de,Main_playingMessage
	ld c,_STROUT
	call BDOS
	ld hl,(Main_currentTrack)
	call Main_PrintDecHL
	ld e,13
	ld c,_CONOUT
	call BDOS
	ld bc,(Main_currentTrack)
	ld a,0
	ld hl,SoundData + 1
	call RePlayer_Play
	call RePlayer_Tick
Main_Loop:
	call Main_WaitFrame
	call RePlayer_Tick
	ld c,_CONST
	call BDOS
	and a
	jr z,Main_Loop
	ld c,_INNOE
	call BDOS
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
	ld ix,WRTVDP
	call Memory_CallBIOS
	jp Main_Loop
Main_End:
	call RePlayer_Stop
	ld de,Main_byeMessage
	ld c,_STROUT
	jp BDOS

Main_WaitFrame:
	ld a,(JIFFY)
	ld c,a
Main_WaitFrame_Loop:
	halt
	ld a,(JIFFY)
	cp c
	jr z,Main_WaitFrame_Loop
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

; hl = number
Main_PrintDecHL:
	ld bc,10000
	call Main_PrintDecHL_Count
	ld bc,1000
	call Main_PrintDecHL_Count
	ld bc,100
	call Main_PrintDecHL_Count
	ld bc,10
	call Main_PrintDecHL_Count
	ld bc,1
Main_PrintDecHL_Count:
	xor a
Main_PrintDecHL_CountLoop:
	sbc hl,bc
	inc a
	jr nc,Main_PrintDecHL_CountLoop
	add hl,bc
	dec a
	add a,"0"
	push hl
	ld e,a
	ld c,_CONOUT
	call BDOS
	pop hl
	ret

Main_message:
	db "Re-play",13,10,10
	db "N - Next track",13,10
	db "B - Previous track",13,10
	db "R - Restart track",13,10
	db "P - Toggle pause",13,10
	db "F - Toggle frequency",13,10,10,"$"

Main_playingMessage:
	db "Playing: $"

Main_byeMessage:
	db 13,10,10,"Bye.",13,10,"$"

; Data in RAM
Main_currentTrack:
	dw 0
Main_loadBuffer:
	ds 1000H
