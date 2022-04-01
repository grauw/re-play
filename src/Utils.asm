IDBYT2: equ 2DH
GETCPU: equ 183H

; f <- c: turbo R
Utils_IsTurboR:
	ld hl,IDBYT2
	call Memory_ReadBIOS
	add a,-3
	ret

; f <- c: R800
Utils_IsR800:
	call Utils_IsTurboR
	ret nc
	push ix
	ld ix,GETCPU
	call Memory_CallBIOS
	pop ix
	add a,-1
	ret
