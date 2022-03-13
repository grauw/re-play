;
;
;
	INCLUDE "FormatOPN.asm"
	INCLUDE "FormatOPL4Wave.asm"

Player_STACK_CAPACITY: equ 128

; a = format ID (first byte of sound data)
; f <- c: found
Player_Detect:
	call Player_Detect_Format
	jp c,Player_SetJumpTable
	jp Player_ClearJumpTable

; a = format ID (first byte of sound data)
; f <- c: found
Player_Detect_Format:
	cp FormatOPN_ID
	jp z,FormatOPN_Detect
	cp FormatOPL4Wave_ID
	jp z,FormatOPL4Wave_Detect
	and a
	ret

; f <- c: found
; hl = jump table
Player_SetJumpTable:
	ld de,Player_Process
	ld bc,3 * 3
	ldir
	ret

; f <- c: found
Player_ClearJumpTable:
	ld hl,Player_Process
	ld de,Player_Process + 1
	ld bc,3 * 3 - 1
	ld (hl),0C9H  ; ret
	ldir
	ret

; bc = track number
; ahl = sound data
Player_Play:
	inc hl
	add hl,bc
	add hl,bc
	add hl,bc
	add hl,bc
	ld b,a
	xor a
	ld (Player_playing),a
	ld a,b
	ld ix,Player_stack
	call Player_Push
	ld a,1
	ld (ix),a
	ld (Player_stackPointer),ix
	ld (Player_playing),a
	ret

Player_Stop:
	xor a
	ld (Player_playing),a
	call Player_Mute
	ret

Player_Resume:
	call Player_Restore
	ld a,1
	ld (Player_playing),a
	ret

Player_TogglePause:
	ld a,(Player_playing)
	and a
	jr z,Player_Resume
	jr Player_Stop

Player_Tick:
	ld a,(Player_playing)
	and a
	ret z
	ld ix,(Player_stackPointer)
	dec (ix)
	ret nz
	call Mapper_GetBank
	push af
	call Player_Pop
	call Mapper_SetBank
	call Player_Process
	ld b,a
	call Mapper_GetBank
	call Player_Push
	ld (ix),b
	ld (Player_stackPointer),ix
	pop af
	call Mapper_SetBank
	ret

; hl = sound data
Player_Jump:
	ld e,(hl)
	inc hl
	ld d,(hl)
	inc hl
	call Mapper_GetBank
	add a,(hl)
	inc hl
	add hl,de
	jp Mapper_SetBank

; hl = sound data
; ix = stack pointer
Player_Call:
	ld e,(hl)
	inc hl
	ld d,(hl)
	inc hl
	ld b,(hl)
	inc hl
	call Mapper_GetBank
	call Player_Push
	add hl,de
	add a,b
	jp Mapper_SetBank

; hl = sound data
; ix = stack pointer
Player_Return:
	call Player_Pop
	jp Mapper_SetBank

; hl = value
; ix = stack pointer
; ix <- stack pointer
Player_Push:
	ld (ix + 0),l
	ld (ix + 1),h
	ld (ix + 2),a
	inc ix
	inc ix
	inc ix
	ret

; ix = stack pointer
; hl <- value
; ix <- stack pointer
Player_Pop:
	dec ix
	dec ix
	dec ix
	ld l,(ix + 0)
	ld h,(ix + 1)
	ld a,(ix + 2)
	ret

; Data in RAM
Player_playing:
	db 0
Player_stackPointer:
	dw Player_stack
Player_stack:
	ds Player_STACK_CAPACITY * 3 + 1
Player_Process:
	db 0C9H, 0, 0
Player_Mute:
	db 0C9H, 0, 0
Player_Restore:
	db 0C9H, 0, 0
