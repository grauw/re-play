;
;
;
WRTVDP: equ 0047H
INITXT: equ 006CH
CHSNS: equ 009CH
CHGET: equ 009FH
CHPUT: equ 00A2H
JIFFY: equ 0FC9EH
RG9SAV: equ 0FFE8H

Mapper_GetBank: equ ASCII8Mapper_GetBank
Mapper_SetBank: equ ASCII8Mapper_SetBank

	org 4000H

	db "AB"
	dw Main
	dw 0, 0, 0, 0, 0, 0

RAM: ds 200H

	SECTION RAM

	org 0C000H

	ENDS

	INCLUDE "Player.asm"
	INCLUDE "Memory.asm"
	INCLUDE "ASCII8Mapper.asm"

Main:
	ei
	ld h,40H
	call Memory_GetSlot
	ld h,80H
	call Memory_SetSlot
	call ASCII8Mapper_Initialize
	ld hl,RAM
	ld de,0C000H
	ld bc,200H
	ldir
	call INITXT
	ld hl,Main_message
	call Main_PrintString

	ld a,(SoundData)
	call Player_Detect
Main_Play:
	ld bc,(Main_currentTrack)
	ld a,1
	ld hl,SoundData + 1
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
	call CHSNS
	pop bc
	jr z,Main_Loop
	push bc
	call CHGET
	pop bc
	or 20H  ; lower-case
	cp "p"
	jr z,Main_Pause
	cp "n"
	jr z,Main_Next
	cp "b"
	jr z,Main_Previous
	cp "f"
	jr z,Main_ToggleFrequency
	jr Main_End
Main_Pause:
	push bc
	call Player_TogglePause
	pop bc
	jr Main_Loop
Main_Next:
	call Player_Stop
	ld bc,(Main_currentTrack)
	inc bc
	ld (Main_currentTrack),bc
	jp Main_Play
Main_Previous:
	call Player_Stop
	ld bc,(Main_currentTrack)
	dec bc
	ld (Main_currentTrack),bc
	jp Main_Play
Main_ToggleFrequency:
	push bc
	ld a,(RG9SAV)
	xor 00000010B
	ld (RG9SAV),a
	ld b,a
	ld c,9
	call WRTVDP
	pop bc
	jp Main_Loop
Main_End:
	call Player_Stop
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
	db "P - Toggle pause",13,10
	db "F - Toggle frequency",13,10,0

	SECTION RAM

; Data in RAM
Main_currentTrack:
	dw 0

	ENDS

	ds 6000H - $

SoundData:
	INCBIN "rom.rep"

	ds -$ & 0x1FFF  ; pad
