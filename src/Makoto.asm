;
; Makoto - Yamaha YM2608 OPNA
;
Makoto_BASE: equ 14H
Makoto_STATUS0: equ Makoto_BASE  ; do not use, bus conflict with Music Module
Makoto_STATUS1: equ Makoto_BASE + 2
Makoto_FM1_ADDRESS: equ Makoto_BASE
Makoto_FM1_DATA: equ Makoto_BASE + 1
Makoto_FM2_ADDRESS: equ Makoto_BASE + 2
Makoto_FM2_DATA: equ Makoto_BASE + 3
Makoto_ADPCM_CONTROL: equ 00H

; f <- c: found
Makoto_Detect:
	in a,(Makoto_STATUS1)
	and 00111111B  ; ignore BUSY, D6 (N/C)
	ret nz
	ld a,Makoto_ADPCM_CONTROL
	out (Makoto_FM2_ADDRESS),a
	ld a,10000000B
	out (Makoto_FM2_DATA),a
	in a,(Makoto_STATUS1)
	and 00111111B  ; ignore BUSY, D6 (N/C)
	push af
	ld a,Makoto_ADPCM_CONTROL
	out (Makoto_FM2_ADDRESS),a
	ld a,00000000B
	out (Makoto_FM2_DATA),a
	pop af
	xor 00100000B
	ret nz
	ld a,1
	ld (Makoto_found),a
	ld de,2980H
	call Makoto_WriteRegister1
	scf
	ret

; hl = sound data
; ix = stack pointer
; a <- wait amount
Makoto_Process:
Makoto_Process_Loop:
	ld a,(hl)
	inc hl
	cp 80H
	jr c,Makoto_Key
	cp 88H
	jr c,Makoto_Frequency
	cp 90H
	jr c,Makoto_Instrument
	jr z,Makoto_Jump
	sub 92H
	jr c,Makoto_Call
	jr z,Makoto_Return
	ret

; hl = sound data
Makoto_Jump:
	call Player_Jump
	jp Makoto_Process_Loop

; hl = sound data
; ix = stack pointer
Makoto_Call:
	call Player_Call
	jp Makoto_Process_Loop

; hl = sound data
; ix = stack pointer
Makoto_Return:
	call Player_Return
	jp Makoto_Process_Loop

; hl = sound data
Makoto_Key:
	ld e,a
	and 0F8H
	add a,e  ; shift bits 3-7 to the left
	ld e,a
	ld d,28H
	call Makoto_WriteRegister1
	jp Makoto_Process_Loop

; hl = sound data
Makoto_Frequency:
	bit 2,a
	jr nz,Makoto_Frequency2
Makoto_Frequency1:
	and 3
	add a,0A0H
	push af
	add a,4
	ld d,a
	inc hl
	inc hl
	ld e,(hl)
	inc hl
	call Makoto_WriteRegister1
	pop de
	ld e,(hl)
	inc hl
	call Makoto_WriteRegister1
	jp Makoto_Process_Loop
Makoto_Frequency2:
	and 3
	add a,0A0H
	push af
	add a,4
	ld d,a
	inc hl
	inc hl
	ld e,(hl)
	inc hl
	call Makoto_WriteRegister2
	pop de
	ld e,(hl)
	inc hl
	call Makoto_WriteRegister2
	jp Makoto_Process_Loop

; hl = sound data
Makoto_Instrument:
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
	call Makoto_Instrument_Set
	jp Makoto_Process_Loop

; a = channel
; hl = sound data
; hl <- next sound data
Makoto_Instrument_Set:
	bit 2,a
	jr nz,Makoto_Instrument2
Makoto_Instrument1:
	and 3
	add a,30H
	ld b,24
Makoto_Instrument1_Loop:
	ld d,a
	ld e,(hl)
	inc hl
	call Makoto_WriteRegister1
	add a,4
	djnz Makoto_Instrument1_Loop
	add a,20H
	ld d,a
	ld e,(hl)
	inc hl
	jp Makoto_WriteRegister1
Makoto_Instrument2:
	and 3
	add a,30H
	ld b,24
Makoto_Instrument2_Loop:
	ld d,a
	ld e,(hl)
	inc hl
	call Makoto_WriteRegister2
	add a,4
	djnz Makoto_Instrument2_Loop
	add a,20H
	ld d,a
	ld e,(hl)
	inc hl
	jp Makoto_WriteRegister2

Makoto_Mute:
	ld b,10H
	ld de,800FH
Makoto_Mute_ReleaseRateLoop:
	call Makoto_WriteRegister1
	call Makoto_WriteRegister2
	inc d
	djnz Makoto_Mute_ReleaseRateLoop
	ld b,08H
	ld de,2800H
Makoto_Mute_KeyOffLoop:
	call Makoto_WriteRegister1
	inc e
	djnz Makoto_Mute_KeyOffLoop
	ret

Makoto_Restore:
	ld a,0
	ld hl,Player_instruments
Makoto_Restore_Loop:
	ld e,(hl)
	inc hl
	ld d,(hl)
	inc hl
	push af
	push hl
	ex de,hl
	call Makoto_Instrument_Set
	pop hl
	pop af
	inc a
	cp 8
	jr c,Makoto_Restore_Loop
	ret

; d = register
; e = value
Makoto_WriteRegister1:
	push af
Makoto_WriteRegister1_Wait:
	in a,(Makoto_STATUS1)
	rla
	jr c,Makoto_WriteRegister1_Wait
	ld a,d
	out (Makoto_FM1_ADDRESS),a
	jp $ + 3  ; wait 17 cycles (7.6 bus cycles)
	ld a,e
	out (Makoto_FM1_DATA),a
	pop af
	ret

; d = register
; e = value
Makoto_WriteRegister2:
	push af
Makoto_WriteRegister2_Wait:
	in a,(Makoto_STATUS1)
	rla
	jr c,Makoto_WriteRegister2_Wait
	ld a,d
	out (Makoto_FM2_ADDRESS),a
	jp $ + 3  ; wait 17 cycles (7.6 bus cycles)
	ld a,e
	out (Makoto_FM2_DATA),a
	pop af
	ret

; Data in RAM
Makoto_found:
	db 0
