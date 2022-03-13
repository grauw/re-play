;
;
;
Konami4Mapper_Initialize:
	ld a,1
	ld (6000H),a
	ld a,2
	ld (8000H),a
	ld a,3
	ld (0A000H),a
	ret

Konami4Mapper_GetBank:
	ld a,(Konami4Mapper_currentBank)
	ret

; a = bank
Konami4Mapper_SetBank:
	ld (Konami4Mapper_currentBank),a
	ld (6000H),a
	ret

	SECTION RAM

Konami4Mapper_currentBank:
	db 0

	ENDS
