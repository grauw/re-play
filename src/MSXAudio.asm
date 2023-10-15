;
; MSX-AUDIO - Yamaha Y8950
;
MSXAudio_FM_BASE: equ 0C0H
MSXAudio_STATUS: equ MSXAudio_FM_BASE
MSXAudio_FM_ADDRESS: equ MSXAudio_FM_BASE
MSXAudio_FM_DATA: equ MSXAudio_FM_BASE + 1
MSXAudio_ADPCM_CONTROL: equ 07H

; f <- c: found
MSXAudio_Detect:
	in a,(MSXAudio_STATUS)
	and 11111001B
	ret nz
	ld de,MSXAudio_ADPCM_CONTROL << 8 | 10000000B
	call MSXAudio_WriteRegister
	in a,(MSXAudio_STATUS)
	and 11111001B
	push af
	ld de,MSXAudio_ADPCM_CONTROL << 8 | 00000000B
	call MSXAudio_WriteRegister
	pop af
	xor 00000001B
	ret nz
	scf
	ret

MSXAudio_JumpTable:
	jp MSXAudio_Process
	jp MSXAudio_Mute
	jp MSXAudio_Restore

; hl = sound data
; ix = stack pointer
; a <- wait amount
MSXAudio_Process:
MSXAudio_Process_Loop:
	ld a,(hl)
	inc hl
	add a,a
	jr nc,MSXAudio_Process_FM
	jp p,MSXAudio_WriteWave
	cp 0C1H << 1
	jp c,MSXAudio_Call
	jp z,MSXAudio_Return
	cp 0C3H << 1
	jp c,MSXAudio_Jump
	jp z,MSXAudio_WaitLoad
	sub 0C4H << 1
	jr z,MSXAudio_WriteMemory
	rrca
	ret
MSXAudio_Process_FM:
	jp p,MSXAudio_WriteFM1
	jp MSXAudio_WriteFM2

; a = count * 2 - 2
; hl = sound data
MSXAudio_WriteFM1:
	add a,02H
	ld b,a
	ld c,MSXAudio_FM_DATA
MSXAudio_WriteFM1_Loop:
	dec c
	outi
	ld a,($)  ; extra wait for R800 -- wait 3.4 µs (12 Y8950 cycles)
	ld a,($)
	inc c
	outi
	push hl
	dec hl
	ld a,(hl)
	dec hl
	ld l,(hl)
	ld h,MSXAudio_registerMirrors >> 8
	ld (hl),a
	pop hl
	ex (sp),ix  ; extra wait for R800 -- wait 23.5 µs (84 Y8950 cycles)
	ex (sp),ix
	ex (sp),ix
	ex (sp),ix
	ex (sp),ix
	ex (sp),ix
	ex (sp),ix
	ex (sp),ix
	jp nz,MSXAudio_WriteFM1_Loop
	jp MSXAudio_Process_Loop

; a = 80H + count * 2 - 2
; hl = sound data
MSXAudio_WriteFM2:
	add a,02H
	ld c,a
	ld b,0
	add hl,bc
	jp MSXAudio_Process_Loop

; a = count * 2 - 2
; hl = sound data
MSXAudio_WriteWave:
	add a,02H
	ld c,a
	ld b,0
	add hl,bc
	jp MSXAudio_Process_Loop

; hl = sound data
MSXAudio_WaitLoad: equ MSXAudio_Process_Loop
	; jp MSXAudio_Process_Loop

; hl = sound data
MSXAudio_WriteMemory:
	inc hl
	inc hl
	inc hl
	ld c,(hl)
	inc hl
	ld b,(hl)
	inc hl
	add hl,bc
	jp MSXAudio_Process_Loop

; hl = sound data
MSXAudio_Jump:
	Player_Jump_M
	jp MSXAudio_Process_Loop

; hl = sound data
; ix = stack pointer
MSXAudio_Call:
	Player_Call_M
	jp MSXAudio_Process_Loop

; hl = sound data
; ix = stack pointer
MSXAudio_Return:
	Player_Return_M
	jp MSXAudio_Process_Loop

MSXAudio_Mute:
	ld a,0BDH
	call MSXAudio_ReadRegister
	and 11100000B
	ld e,a
	ld d,0BDH
	call MSXAudio_WriteRegister
	ld b,9
MSXAudio_MuteFM_Loop:
	ld a,0B9H
	sub b
	ld d,a
	call MSXAudio_ReadRegister
	and 11011111B
	ld e,a
	call MSXAudio_WriteRegister
	djnz MSXAudio_MuteFM_Loop
	ret

MSXAudio_Restore:
	ret

; d = register
; e = value
MSXAudio_WriteRegister:
	ld a,d
	out (MSXAudio_FM_ADDRESS),a
	ex (sp),hl  ; extra wait for R800 -- wait 3.4 µs (24 cycles)
	ex (sp),hl
	ld a,e
	out (MSXAudio_FM_DATA),a
	ld l,a
	ld h,MSXAudio_registerMirrors >> 8
	ld (hl),e
	ex (sp),ix  ; extra wait for R800 -- wait 23.5 µs (168 cycles)
	ex (sp),ix
	ex (sp),ix
	ex (sp),ix
	ex (sp),ix
	ex (sp),ix
	ex (sp),ix
	ex (sp),ix
	ex (sp),ix
	ex (sp),ix
	ret

; a = register
; a = value
MSXAudio_ReadRegister:
	ld l,a
	ld h,MSXAudio_registerMirrors >> 8
	ld a,(hl)
	ret

; a = value
MSXAudio_ReadStatusRegister:
	in a,(MSXAudio_STATUS)
	ret

	SECTION RAM

	ds -$ & 0xFF  ; align to 100H

MSXAudio_registerMirrors:
	ds 100H

	ENDS
