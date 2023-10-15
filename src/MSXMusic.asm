;
; MSX-MUSIC - Yamaha YM2413
;
MSXMusic_BASE: equ 07CH
MSXMusic_ADDRESS: equ MSXMusic_BASE
MSXMusic_DATA: equ MSXMusic_BASE + 1
MSXMusic_ID_ADDRESS: equ 4018H
MSXMusic_ENABLE_ADDRESS: equ 7FF6H

; a <- slot ID (if found)
; b <- 0: external, -1: internal
; f <- c: found
MSXMusic_Detect:
	ld hl,MSXMusic_Detect_MatchInternalID
	call Memory_SearchSlots
	ld b,-1
	ret c
	ld hl,MSXMusic_Detect_MatchExternalID
	call Memory_SearchSlots
	push af
	call MSXMusic_Enable
	pop af
	ld b,0
	ret

; a = slot id
; f <- c: found
MSXMusic_Detect_MatchInternalID:
	ld de,MSXMusic_internalId
	ld hl,MSXMusic_ID_ADDRESS
	ld bc,8
	jp Memory_MatchSlotString

; a = slot id
; f <- c: found
MSXMusic_Detect_MatchExternalID:
	ld de,MSXMusic_externalId
	ld hl,MSXMusic_ID_ADDRESS + 4
	ld bc,4
	jp Memory_MatchSlotString

; a = slot id
MSXMusic_Enable:
	push af
	ld hl,MSXMusic_ENABLE_ADDRESS
	call Memory_ReadSlot
	set 0,a
	ld e,a
	pop af
	ld hl,MSXMusic_ENABLE_ADDRESS
	jp Memory_WriteSlot

; a = slot id
MSXMusic_Disable:
	push af
	ld hl,MSXMusic_ENABLE_ADDRESS
	call Memory_ReadSlot
	res 0,a
	ld e,a
	pop af
	ld hl,MSXMusic_ENABLE_ADDRESS
	jp Memory_WriteSlot

; a = count * 2 - 2
; hl = sound data
MSXMusic_WriteBlockR800:
	add a,02H
	ld b,a
	ld c,MSXMusic_DATA
MSXMusic_WriteBlockR800_Loop:
	dec c
	outi
	in a,(MSXMusic_BASE)  ; extra wait for R800 -- wait 3.4 µs (12 YM2413 cycles)
	in a,(MSXMusic_BASE)
	inc c
	outi
	push hl
	dec hl
	ld a,(hl)
	dec hl
	ld l,(hl)
	ld h,MSXMusic_registerMirrors >> 8
	ld (hl),a
	pop hl
	in a,(MSXMusic_BASE)  ; extra wait for R800 -- wait 23.5 µs (84 YM2413 cycles)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	jp nz,MSXMusic_WriteBlockR800_Loop
	jp FormatOPLLPSG_ProcessR800

; a = count * 2 - 2
; hl = sound data
MSXMusic_WriteBlockZ80:
	add a,02H
	ld b,a
	ld c,MSXMusic_DATA
MSXMusic_WriteBlockZ80_Loop:
	dec c
	outi
	inc c
	outi
	push hl
	dec hl
	ld a,(hl)
	dec hl
	ld l,(hl)
	ld h,MSXMusic_registerMirrors >> 8
	ld (hl),a
	pop hl
	jp nz,MSXMusic_WriteBlockZ80_Loop
	jp FormatOPLLPSG_ProcessZ80

MSXMusic_Mute:
	ld a,0FH
	call MSXMusic_ReadRegister
	and 11100000B
	ld e,a
	ld d,0FH
	call MSXMusic_WriteRegister
	ld b,9
MSXMusic_Mute_Loop:
	ld a,29H
	sub b
	ld d,a
	call MSXMusic_ReadRegister
	and 11001111B
	ld e,a
	call MSXMusic_WriteRegister
	djnz MSXMusic_Mute_Loop
	ret

MSXMusic_Restore:
	ret

; d = register
; e = value
MSXMusic_WriteRegister:
	ld a,d
	out (MSXMusic_ADDRESS),a
	in a,(MSXMusic_BASE)  ; extra wait for R800 -- wait 3.4 µs (12 YM2413 cycles)
	in a,(MSXMusic_BASE)
	ld a,e
	out (MSXMusic_DATA),a
	ld l,a
	ld h,MSXMusic_registerMirrors >> 8
	ld (hl),e
	in a,(MSXMusic_BASE)  ; extra wait for R800 -- wait 23.5 µs (84 YM2413 cycles)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	in a,(MSXMusic_BASE)
	ret

; a = register
; a = value
MSXMusic_ReadRegister:
	ld l,a
	ld h,MSXMusic_registerMirrors >> 8
	ld a,(hl)
	ret

MSXMusic_internalId:
	db "APRLOPLL"

MSXMusic_externalId:
	db "OPLL"

	SECTION RAM

	ds -$ & 0xFF  ; align to 100H

MSXMusic_registerMirrors:
	ds 40H

	ENDS
