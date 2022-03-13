;
;
;
ASCII16Mapper_Initialize:
	ld a,0
	ld (6000H),a
	ld a,1
	ld (7000H),a
	ret

ASCII16Mapper_GetBank:
	ld a,(ASCII16Mapper_currentBank)
	ret

; a = bank
ASCII16Mapper_SetBank:
	ld (ASCII16Mapper_currentBank),a
	ld (7000H),a
	ret

	SECTION RAM

ASCII16Mapper_currentBank:
	db 0

	ENDS
