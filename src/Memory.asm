;
;
;
RDSLT: equ 000CH
WRSLT: equ 0014H
CALSLT: equ 001CH
ENASLT: equ 0024H
EXPTBL: equ 0FCC1H

; h = memory address high byte (bits 6-7: page)
; a <- slot ID formatted FxxxSSPP
; Modifies: f, bc, de
Memory_GetSlot:
    in a,(0A8H)
    bit 7,h
    jr z,Memory_GetSlot_PrimaryShiftContinue
    rrca
    rrca
    rrca
    rrca
Memory_GetSlot_PrimaryShiftContinue:
    bit 6,h
    jr z,Memory_GetSlot_PrimaryShiftDone
    rrca
    rrca
Memory_GetSlot_PrimaryShiftDone:
    and 00000011B
    ld c,a
    ld b,0
    ex de,hl
    ld hl,EXPTBL
    add hl,bc
    ld a,(hl)
    and 80H
    or c
    ld c,a
    inc hl  ; move to SLTTBL
    inc hl
    inc hl
    inc hl
    ld a,(hl)
    ex de,hl
    bit 7,h
    jr z,Memory_GetSlot_SecondaryShiftContinue
    rrca
    rrca
    rrca
    rrca
Memory_GetSlot_SecondaryShiftContinue:
    bit 6,h
    jr nz,Memory_GetSlot_SecondaryShiftDone
    rlca
    rlca
Memory_GetSlot_SecondaryShiftDone:
    and 00001100B
    or c
    ret

; h = memory address high byte (bits 6-7: page)
; a <- slot ID formatted FxxxSSPP
; Modifies: af, bc, de
Memory_SetSlot:
	call ENASLT
	ei
	ret

; a = slot ID
; hl = address (00H <= h < C0H)
; a <- value
; Modifies: af, bc, de
Memory_ReadSlot:
	call RDSLT
	ei
	ret

; a = slot ID
; e = value
; hl = address (00H <= h < C0H)
; Modifies: af, bc, de
Memory_WriteSlot:
	call WRSLT
	ei
	ret

; Search all slots and subslots for a match.
; Invoke Continue to continue searching where a previous search left off.
; hl = detection routine (receives a = slot ID, can modify all)
; f <- c: found
; a <- slot number
; Modifies: af, bc, de
Memory_SearchSlots:
	ld a,0
Memory_SearchSlots_PrimaryLoop:
	ex de,hl
	ld hl,EXPTBL
	ld b,0
	ld c,a
	add hl,bc
	ld a,(hl)
	ex de,hl
	and 10000000B
	or c
Memory_SearchSlots_SecondaryLoop:
	push af
	push hl
	call Memory_SearchSlots_JumpHL
	pop hl
	jp c,Memory_SearchSlots_Found
	pop af
	add a,00000100B
	jp p,Memory_SearchSlots_NextPrimary
	bit 4,a
	jp z,Memory_SearchSlots_SecondaryLoop
Memory_SearchSlots_NextPrimary:
	inc a
	and 00000011B
	ret z  ; not found
	jp Memory_SearchSlots_PrimaryLoop
Memory_SearchSlots_Found:
	pop af
	scf
	ret
Memory_SearchSlots_JumpHL:
	jp hl

; Match a string in a slot.
; a = slot
; bc = string length
; de = string
; hl = address
; f <- c: found
; Modifies: f, bc, de, hl
Memory_MatchSlotString:
	push af
	push bc
	push de
	call RDSLT
	ei
	pop de
	pop bc
	ex de,hl
	cpi
	jr nz,Memory_MatchSlotString_NotFound
	jp po,Memory_MatchSlotString_Found
	inc de
	ex de,hl
	pop af
	jp Memory_MatchSlotString
Memory_MatchSlotString_Found:
	pop af
	scf
	ret
Memory_MatchSlotString_NotFound:
	pop af
	and a
	ret

; ix = address
Memory_CallBIOS:
	ld iy,(EXPTBL - 1)
	call CALSLT
	ei
	ret

; hl = address
Memory_ReadBIOS:
	ld a,(EXPTBL)
	call RDSLT
	ei
	ret
