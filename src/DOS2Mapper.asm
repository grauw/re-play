;
;
;
EXTBIO: equ 0FFCAH

DOS2Mapper_Initialize:
	ld a,0
	ld de,0402H
	call EXTBIO
	ld a,b
	ld (DOS2Mapper_primaryMapperSlot),a
	ld de,ALL_SEG
	ld bc,16 * 3
	ldir
	ld h,40H
	call GET_PH
	ld (DOS2Mapper_banks + 0),a
	call Memory_GetSlot
	ld (DOS2Mapper_banks + 1),a
	ld h,80H
	call GET_PH
	ld (DOS2Mapper_banks + 2),a
	call Memory_GetSlot
	ld (DOS2Mapper_banks + 3),a
	ld a,1
	ld (DOS2Mapper_lastBank),a
	ld a,0
	ld (DOS2Mapper_currentBank),a
	ret

; a <- bank index
; f <- c: allocation failed
DOS2Mapper_Allocate:
	ld a,(DOS2Mapper_primaryMapperSlot)
	or 00100000B  ; allocate primary slot, or another
	ld b,a
	ld a,0
	call ALL_SEG
	ret c
	ld c,a
	ld a,(DOS2Mapper_lastBank)
	add a,1
	ret c
	ld (DOS2Mapper_lastBank),a
	ld e,a
	ld d,0
	ld hl,DOS2Mapper_banks
	add hl,de
	add hl,de
	ld (hl),c
	inc hl
	ld (hl),b
	ret

DOS2Mapper_GetBank:
	ld a,(DOS2Mapper_currentBank)
	ret

; a = bank
DOS2Mapper_SetBank:
	ld (DOS2Mapper_currentBank),a
	exx
	ld hl,DOS2Mapper_banks
	ld e,a
	ld d,0
	add hl,de
	add hl,de
	ld a,(hl)
	inc hl
	ld d,(hl)
	call PUT_P1
	ld a,d
	ld h,40H
	call ENASLT
	ei
	exx
	ret

; Data in RAM
ALL_SEG:
	jp 0
FRE_SEG:
	jp 0
RD_SEG:
	jp 0
WR_SEG:
	jp 0
CAL_SEG:
	jp 0
CALLS:
	jp 0
PUT_PH:
	jp 0
GET_PH:
	jp 0
PUT_P0:
	jp 0
GET_P0:
	jp 0
PUT_P1:
	jp 0
GET_P1:
	jp 0
PUT_P2:
	jp 0
GET_P2:
	jp 0
PUT_P3:
	jp 0
GET_P3:
	jp 0
DOS2Mapper_primaryMapperSlot:
	db 0
DOS2Mapper_lastBank:
	db 0
DOS2Mapper_currentBank:
	db 0
DOS2Mapper_banks:
	ds 100H * 2
