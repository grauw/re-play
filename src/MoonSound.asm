;
; MoonSound - Yamaha YMF278B OPL4
;
MoonSound_FM_BASE: equ 0C4H
MoonSound_STATUS: equ MoonSound_FM_BASE
MoonSound_FM1_ADDRESS: equ MoonSound_FM_BASE
MoonSound_FM1_DATA: equ MoonSound_FM_BASE + 1
MoonSound_FM2_ADDRESS: equ MoonSound_FM_BASE + 2
MoonSound_FM2_DATA: equ MoonSound_FM_BASE + 3
MoonSound_WAVE_BASE: equ 07EH
MoonSound_WAVE_ADDRESS: equ MoonSound_WAVE_BASE
MoonSound_WAVE_DATA: equ MoonSound_WAVE_BASE + 1

; f <- c: found
MoonSound_Detect:
	call MoonSound_ReadStatusRegister  ; skip potential 02H read
	call MoonSound_ReadStatusRegister
	and a
	ret nz
	ld de,0503H
	call MoonSound_WriteFM2Register  ; enable FM2, WAVE
	ld a,02H
	call MoonSound_ReadWaveRegister  ; check ID
	and 11100000B
	xor 00100000B
	ret nz
	ld a,1
	ld (MoonSound_found),a
	ld de,0210H
	call MoonSound_WriteWaveRegister  ; set standard memory layout
	scf
	ret

; hl = sound data
; ix = stack pointer
; a <- wait amount
MoonSound_Process:
MoonSound_Process_Loop:
	ld a,(hl)
	inc hl
	cp 008H
	ret c
	cp 0FAH
	jr c,MoonSound_Write
	cp 0FBH
	jr c,MoonSound_WaitLoad
	jr z,MoonSound_Jump
	sub 0FDH
	jr c,MoonSound_Call
	jr z,MoonSound_Return
	ret

; hl = sound data
MoonSound_Jump:
	call Player_Jump
	jp MoonSound_Process_Loop

; hl = sound data
; ix = stack pointer
MoonSound_Call:
	call Player_Call
	jp MoonSound_Process_Loop

; hl = sound data
; ix = stack pointer
MoonSound_Return:
	call Player_Return
	jp MoonSound_Process_Loop

; hl = sound data
MoonSound_Write:
	out (MoonSound_WAVE_ADDRESS),a
	cp (hl)  ; extra wait for R800 -- wait 2.6 µs (19 cycles, but 18 works)
	ld a,(hl)
	inc hl
	out (MoonSound_WAVE_DATA),a
	jp MoonSound_Process_Loop

; hl = sound data
MoonSound_WaitLoad:
	in a,(MoonSound_STATUS)
	and 00000010B
	jr nz,MoonSound_WaitLoad
	jp MoonSound_Process_Loop

MoonSound_Mute:
	ld b,24
MoonSound_Mute_Loop:
	ld a,80H
	sub b
	ld d,a
	call MoonSound_ReadWaveRegister
	and 00111111B
	or 01000000B
	ld e,a
	call MoonSound_WriteWaveRegister
	djnz MoonSound_Mute_Loop
	ret

MoonSound_Restore:
	ret

; d = register
; e = value
MoonSound_WriteFM1Register:
	ld a,d
	out (MoonSound_FM1_ADDRESS),a
	nop  ; extra wait for R800 -- wait 1.7 µs (12 cycles)
	ld a,e
	out (MoonSound_FM1_DATA),a
	ret

; d = register
; e = value
MoonSound_WriteFM2Register:
	ld a,d
	out (MoonSound_FM2_ADDRESS),a
	nop  ; extra wait for R800 -- wait 1.7 µs (12 cycles)
	ld a,e
	out (MoonSound_FM2_DATA),a
	ret

; d = register
; e = value
MoonSound_WriteWaveRegister:
	ld a,d
	out (MoonSound_WAVE_ADDRESS),a
	cp (ix)  ; extra wait for R800 -- wait 2.6 µs (19 cycles, but 18 works)
	ld a,e
	out (MoonSound_WAVE_DATA),a
	ret

; a = register
; a = value
MoonSound_ReadWaveRegister:
	out (MoonSound_WAVE_ADDRESS),a
	cp (ix)  ; extra wait for R800 -- wait 2.6 µs (19 cycles, but 18 works)
	nop
	in a,(MoonSound_WAVE_DATA)
	ret

; a = value
MoonSound_ReadStatusRegister:
	in a,(MoonSound_STATUS)
	ret

; Data in RAM
MoonSound_found:
	db 0
