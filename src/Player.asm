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

; hl = sound data
Player_Play:
	inc hl
	xor a
	ld (Player_playing),a
	ld (Player_position),hl
	ld hl,Player_stack
	ld (hl),Player_infiniteLoop
	inc hl
	ld (hl),Player_infiniteLoop >> 8
	inc hl
	ld (Player_stackPointer),hl
	inc a
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
	ld ix,(Player_stackPointer)
	ld hl,(Player_position)
	call Player_Process
	ld (Player_wait),a
	ld (Player_position),hl
	ld (Player_stackPointer),ix
	ret

; Data in RAM
Player_playing:
	db 0
Player_position:
	dw 0
Player_wait:
	db 0
Player_stackPointer:
	dw Player_stack
Player_stack:
	ds Player_STACK_CAPACITY * 2
Player_infiniteLoop:
	db 0FFH, 90H, 0FCH, 0FFH
Player_instruments:
	ds 8 * 2
Player_Process:
	db 0C9H, 0, 0
Player_Mute:
	db 0C9H, 0, 0
Player_Restore:
	db 0C9H, 0, 0
