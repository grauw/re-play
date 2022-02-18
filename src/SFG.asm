;
; Yamaha SFG-01 / SFG-05 - Yamaha YM2151 OPM
;
SFG_BASE: equ 0BFF0H
SFG_ADDRESS: equ SFG_BASE
SFG_DATA: equ SFG_BASE + 1
SFG_STATUS: equ SFG_BASE + 1
SFG_ID_ADDRESS: equ 80H

; f <- c: found
SFG_Detect:
	ld hl,SFG_Detect_MatchID
	call Memory_SearchSlots
	ret nc
	ld (SFG_slot),a
	ld a,1
	ld (SFG_found),a
	ret

; a = slot ID
; f <- c: found
SFG_Detect_MatchID:
	ld de,SFG_id
	ld hl,SFG_ID_ADDRESS
	ld bc,6
	jp Memory_MatchSlotString

; hl = sound data
; a <- wait amount
SFG_Process:
	exx
	ld h,SFG_BASE >> 8
	call Memory_GetSlot
	ex af,af'
	ld a,(SFG_slot)
	ld h,SFG_BASE >> 8
	call ENASLT
	ei
	exx
	call SFG_Process_Loop
	exx
	ex af,af'
	ld h,SFG_BASE >> 8
	call ENASLT
	ei
	ex af,af'
	exx
	ret

; hl = sound data
; ix = stack pointer
; a <- wait amount
SFG_Process_Loop:
	ld a,(hl)
	inc hl
	cp 80H
	jr c,SFG_Key
	cp 88H
	jr c,SFG_Frequency
	cp 90H
	jr c,SFG_Instrument
	jr z,SFG_Jump
	sub 92H
	jr c,SFG_Call
	jr z,SFG_Return
	ret

; hl = sound data
SFG_Jump:
	call Player_Jump
	jp SFG_Process_Loop

; hl = sound data
; ix = stack pointer
SFG_Call:
	call Player_Call
	jp SFG_Process_Loop

; hl = sound data
; ix = stack pointer
SFG_Return:
	call Player_Return
	jp SFG_Process_Loop

; hl = sound data
SFG_Key:
	ld e,a
	ld d,08H
	call SFG_WriteRegister
	jp SFG_Process_Loop

; hl = sound data
SFG_Frequency:
	and 7
	add a,28H
	push af
	add a,8
	ld d,a
	ld e,(hl)
	inc hl
	call SFG_WriteRegister
	pop de
	ld e,(hl)
	inc hl
	call SFG_WriteRegister
	inc hl
	inc hl
	jp SFG_Process_Loop

; hl = sound data
SFG_Instrument:
	and 7
	ex de,hl
	ld c,a
	ld b,0
	ld hl,Player_instruments
	add hl,bc
	add hl,bc
	ld (hl),e
	inc hl
	ld (hl),d
	ex de,hl
	call SFG_Instrument_Set
	jp SFG_Process_Loop

; a = channel
; hl = sound data
; hl <- next sound data
SFG_Instrument_Set:
	add a,40H
	ld b,24
SFG_Instrument_Loop:
	ld d,a
	ld e,(hl)
	inc hl
	call SFG_WriteRegister
	add a,8
	djnz SFG_Instrument_Loop
	add a,20H
	ld d,a
	ld e,(hl)
	inc hl
	jp SFG_WriteRegister

SFG_Mute:
	ld h,SFG_BASE >> 8
	call Memory_GetSlot
	ex af,af'
	ld a,(SFG_slot)
	ld h,SFG_BASE >> 8
	call ENASLT
	ei
	ld b,20H
	ld de,0E00FH
SFG_Mute_ReleaseRateLoop:
	call SFG_WriteRegister
	inc d
	djnz SFG_Mute_ReleaseRateLoop
	ld b,08H
	ld de,0800H
SFG_Mute_KeyOffLoop:
	call SFG_WriteRegister
	inc e
	djnz SFG_Mute_KeyOffLoop
	ex af,af'
	ld h,SFG_BASE >> 8
	call ENASLT
	ei
	ret

SFG_Restore:
	ld h,SFG_BASE >> 8
	call Memory_GetSlot
	ex af,af'
	ld a,(SFG_slot)
	ld h,SFG_BASE >> 8
	call ENASLT
	ei
	ld a,0
	ld hl,Player_instruments
SFG_Restore_Loop:
	ld e,(hl)
	inc hl
	ld d,(hl)
	inc hl
	push af
	push hl
	ex de,hl
	call SFG_Instrument_Set
	pop hl
	pop af
	inc a
	cp 8
	jr c,SFG_Restore_Loop
	ex af,af'
	ld h,SFG_BASE >> 8
	call ENASLT
	ei
	ret

; d = register
; e = value
SFG_WriteRegister:
	push af
SFG_WriteRegister_Wait:
	ld a,(SFG_STATUS)
	rla
	jr c,SFG_WriteRegister_Wait
	ld a,d
	ld (SFG_ADDRESS),a
	cp (hl)  ; R800 wait: ~4 bus cycles
	ld a,e
	ld (SFG_DATA),a
	pop af
	ret

;
SFG_id:
	db "MCHFM0"

; Data in RAM
SFG_found:
	db 0
SFG_slot:
	db 0
