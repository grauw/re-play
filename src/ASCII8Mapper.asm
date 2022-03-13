;
;
;
ASCII8Mapper_Initialize:
	ld a,0
	ld (6000H),a
	ld a,1
	ld (6800H),a
	ld a,2
	ld (7000H),a
	ld a,3
	ld (7800H),a
	ret

ASCII8Mapper_GetBank:
	ld a,(ASCII8Mapper_currentBank)
	ret

; a = bank
ASCII8Mapper_SetBank:
	ld (ASCII8Mapper_currentBank),a
	ld (6800H),a
	ret

	SECTION RAM

ASCII8Mapper_currentBank:
	db 0

	ENDS
