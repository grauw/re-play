;
; PSG - Yamaha YM2149 / General Instruments AY-3-8910
;
PSG_BASE: equ 0A0H
PSG_ADDRESS: equ PSG_BASE
PSG_DATA: equ PSG_BASE + 1
PSG_READ: equ PSG_BASE + 2

; f <- c: found
PSG_Detect:
	scf
	ret

; a = count * 2
; hl = sound data
PSG_WriteBlock:
	ld b,a
	ld c,PSG_DATA
	di
PSG_WriteBlock_Loop:
	dec c
	outi
	inc c
	outi
	jp nz,PSG_WriteBlock_Loop
	ei
	ret

PSG_Mute:
	ld de,0800H
	call PSG_WriteRegister
	ld de,0900H
	call PSG_WriteRegister
	ld de,0A00H
	call PSG_WriteRegister
	ret

PSG_Restore:
	ret

; d = register
; e = value
PSG_WriteRegister:
	ld a,d
	di
	out (PSG_ADDRESS),a
	ld a,e
	ei
	out (PSG_DATA),a
	ret

; a = register
; a = value
PSG_ReadRegister:
	di
	out (PSG_ADDRESS),a
	ei
	in a,(PSG_READ)
	ret
