;
;
;
	INCLUDE "SFG.asm"
	INCLUDE "Makoto.asm"
	INCLUDE "Neotron.asm"

Player_FORMAT_OPN: equ 0

Player_STACK_CAPACITY: equ 128

; hl = sound data
; f <- c: found
Player_Detect:
	ld a,(hl)
	xor Player_FORMAT_OPN
	jp z,Player_Detect_OPN
	jp Player_Detect_Fail

; f <- c: found
Player_Detect_OPN:
	call SFG_Detect
	ld bc,SFG_Process
	ld de,SFG_Mute
	ld hl,SFG_Restore
	jr c,Player_SetProcessAndMute
	call Makoto_Detect
	ld bc,Makoto_Process
	ld de,Makoto_Mute
	ld hl,Makoto_Restore
	jr c,Player_SetProcessAndMute
	call Neotron_Detect
	ld bc,Neotron_Process
	ld de,Neotron_Mute
	ld hl,Neotron_Restore
	jr c,Player_SetProcessAndMute
	jp Player_Detect_Fail

; f <- c: found
Player_Detect_Fail:
	ld a,0C9H  ; ret
	ld (Player_Process),a
	ld (Player_Mute),a
	ld (Player_Restore),a
	ret

; bc = process function
; de = mute function
; hl = restore function
Player_SetProcessAndMute:
	ld a,0C3H  ; jp
	ld (Player_Process),a
	ld (Player_Process + 1),bc
	ld (Player_Mute),a
	ld (Player_Mute + 1),de
	ld (Player_Restore),a
	ld (Player_Restore + 1),hl
	ret

; ahl = sound data
Player_Play:
	inc hl
	push af
	xor a
	ld (Player_playing),a
	ld ix,Player_stack
	push hl
	ld hl,Player_infiniteLoop
	call Player_Push
	pop hl
	pop af
	call Player_Push
	ld (Player_stackPointer),ix
	ld a,1
	ld (Player_wait),a
	ld (Player_playing),a
	ret

Player_Stop:
	xor a
	ld (Player_playing),a
	call Player_Mute
	ret

Player_Resume:
	ld a,1
	ld (Player_playing),a
	call Player_Restore
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
	ld hl,Player_wait
	dec (hl)
	ret nz
	call Mapper_GetBank
	push af
	ld ix,(Player_stackPointer)
	call Player_Pop
	call Mapper_SetBank
	call Player_Process
	ld (Player_wait),a
	call Mapper_GetBank
	call Player_Push
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
	ld b,(hl)
	inc hl
	call Mapper_GetBank
	add hl,de
	add a,b
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
Player_wait:
	db 0
Player_stackPointer:
	dw Player_stack
Player_stack:
	ds Player_STACK_CAPACITY * 3
Player_infiniteLoop:
	db 0FFH, 90H, 0FCH, 0FFH, 0FFH
Player_instruments:
	ds 8 * 2
Player_Process:
	db 0C9H, 0, 0
Player_Mute:
	db 0C9H, 0, 0
Player_Restore:
	db 0C9H, 0, 0
