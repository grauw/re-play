;
; Supersoniqs Neotron / JunSoft OSC1N0 - Yamaha YM2610(B) OPNB
;
Neotron_BASE: equ 0BC00H
Neotron_STATUS0: equ Neotron_BASE
Neotron_STATUS1: equ Neotron_BASE + 2
Neotron_FM1_ADDRESS: equ Neotron_BASE
Neotron_FM1_DATA: equ Neotron_BASE + 1
Neotron_FM2_ADDRESS: equ Neotron_BASE + 2
Neotron_FM2_DATA: equ Neotron_BASE + 3
Neotron_ID_ADDRESS: equ 806CH
Neotron_SIOS_ENABLE_IO: equ 801CH

; f <- c: found
Neotron_Detect:
	ld hl,Neotron_Detect_MatchID
	call Memory_SearchSlots
	ret nc
	push af
	ld iyh,a
	ld (Neotron_slot),a
	ld a,1
	ld (Neotron_found),a
	ld ix,Neotron_SIOS_ENABLE_IO
	and a
	call CALSLT
	ei
	pop af
	ret

; a = slot ID
; f <- c: found
Neotron_Detect_MatchID:
	ld de,Neotron_id
	ld hl,Neotron_ID_ADDRESS
	ld bc,18
	jp Memory_MatchSlotString

; hl = sound data
; a <- wait amount
Neotron_Process:
	exx
	ld h,Neotron_BASE >> 8
	call Memory_GetSlot
	ex af,af'
	ld a,(Neotron_slot)
	ld h,Neotron_BASE >> 8
	call ENASLT
	ei
	exx
	call Neotron_Process_Loop
	exx
	ex af,af'
	ld h,Neotron_BASE >> 8
	call ENASLT
	ei
	ex af,af'
	exx
	ret

; hl = sound data
; a <- wait amount
Neotron_Process_Loop:
	ld a,(hl)
	inc hl
	cp 80H
	jr c,Neotron_Key
	cp 88H
	jr c,Neotron_Frequency
	sub 90H
	jr c,Neotron_Instrument
	ret nz
	ld e,(hl)
	inc hl
	ld d,(hl)
	inc hl
	add hl,de
	jr Neotron_Process_Loop

; hl = sound data
Neotron_Key:
	ld e,a
	and 0F8H
	add a,e  ; shift bits 3-7 to the left
	ld e,a
	ld d,28H
	call Neotron_WriteRegister1
	jr Neotron_Process_Loop

; hl = sound data
Neotron_Frequency:
	bit 2,a
	jr nz,Neotron_Frequency2
Neotron_Frequency1:
	and 3
	add a,0A0H
	push af
	add a,4
	ld d,a
	inc hl
	inc hl
	ld e,(hl)
	inc hl
	call Neotron_WriteRegister1
	pop de
	ld e,(hl)
	inc hl
	call Neotron_WriteRegister1
	jr Neotron_Process_Loop
Neotron_Frequency2:
	and 3
	add a,0A0H
	push af
	add a,4
	ld d,a
	inc hl
	inc hl
	ld e,(hl)
	inc hl
	call Neotron_WriteRegister2
	pop de
	ld e,(hl)
	inc hl
	call Neotron_WriteRegister2
	jr Neotron_Process_Loop

; hl = sound data
Neotron_Instrument:
	bit 2,a
	jr nz,Neotron_Instrument2
	and 3
	add a,30H
	ld b,24
Neotron_Instrument1_Loop:
	ld d,a
	ld e,(hl)
	inc hl
	call Neotron_WriteRegister1
	add a,4
	djnz Neotron_Instrument1_Loop
	add a,20H
	ld d,a
	ld e,(hl)
	inc hl
	call Neotron_WriteRegister1
	jp Neotron_Process_Loop
Neotron_Instrument2:
	and 3
	add a,30H
	ld b,24
Neotron_Instrument2_Loop:
	ld d,a
	ld e,(hl)
	inc hl
	call Neotron_WriteRegister2
	add a,4
	djnz Neotron_Instrument2_Loop
	add a,20H
	ld d,a
	ld e,(hl)
	inc hl
	call Neotron_WriteRegister2
	jp Neotron_Process_Loop

Neotron_Mute:
	ld h,Neotron_BASE >> 8
	call Memory_GetSlot
	ex af,af'
	ld a,(Neotron_slot)
	ld h,Neotron_BASE >> 8
	call ENASLT
	ei
	ld b,10H
	ld de,800FH
Neotron_Mute_ReleaseRateLoop:
	call Neotron_WriteRegister1
	call Neotron_WriteRegister2
	inc d
	djnz Neotron_Mute_ReleaseRateLoop
	ld b,08H
	ld de,2800H
Neotron_Mute_KeyOffLoop:
	call Neotron_WriteRegister1
	inc e
	djnz Neotron_Mute_KeyOffLoop
	ex af,af'
	ld h,Neotron_BASE >> 8
	call ENASLT
	ei
	ret

; d = register
; e = value
Neotron_WriteRegister1:
	push af
Neotron_WriteRegister1_Wait:
	ld a,(Neotron_STATUS0)
	rla
	jr c,Neotron_WriteRegister1_Wait
	ld a,d
	ld (Neotron_FM1_ADDRESS),a
	jp $ + 3  ; wait 17 cycles (7.6 bus cycles)
	ld a,e
	ld (Neotron_FM1_DATA),a
	pop af
	ret

; d = register
; e = value
Neotron_WriteRegister2:
	push af
Neotron_WriteRegister2_Wait:
	ld a,(Neotron_STATUS0)
	rla
	jr c,Neotron_WriteRegister2_Wait
	ld a,d
	ld (Neotron_FM2_ADDRESS),a
	jp $ + 3  ; wait 17 cycles (7.6 bus cycles)
	ld a,e
	ld (Neotron_FM2_DATA),a
	pop af
	ret

;
Neotron_id:
	db "OSC YM  OPNBYM2610"

; Data in RAM
Neotron_found:
	db 0
Neotron_slot:
	db 0
