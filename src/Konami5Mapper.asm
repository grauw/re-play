;
;
;
Konami5Mapper_Initialize:
	ld a,0
	ld (5000H),a
	ld a,1
	ld (7000H),a
	ld a,2
	ld (9000H),a
	ld a,3
	ld (0B000H),a
	ret

Konami5Mapper_GetBank:
	ld a,(Konami5Mapper_currentBank)
	ret

; a = bank
Konami5Mapper_SetBank:
	ld (Konami5Mapper_currentBank),a
	ld (7000H),a
	ret

	SECTION RAM

Konami5Mapper_currentBank:
	db 0

	ENDS
