;
; MSX-AUDIO - Yamaha Y8950
;
; Z80 optimised version.
;

; f <- c: found
MSXAudioZ80_Detect:
	call Utils_IsR800
	ccf
	ret nc
	jp MSXAudio_Detect

MSXAudioZ80_JumpTable:
	jp MSXAudioZ80_Process
	jp MSXAudio_Mute
	jp MSXAudio_Restore

; hl = sound data
; ix = stack pointer
; a <- wait amount
MSXAudioZ80_Process:
MSXAudioZ80_Process_Loop:
	ld a,(hl)
	inc hl
	add a,a
	jr nc,MSXAudioZ80_Process_FM
	jp p,MSXAudioZ80_WriteWave
	cp 0C1H << 1
	jp c,MSXAudioZ80_Call
	jp z,MSXAudioZ80_Return
	cp 0C3H << 1
	jp c,MSXAudioZ80_Jump
	jp z,MSXAudioZ80_WaitLoad
	sub 0C4H << 1
	jr z,MSXAudioZ80_WriteMemory
	rrca
	ret
MSXAudioZ80_Process_FM:
	jp p,MSXAudioZ80_WriteFM1
	jp MSXAudioZ80_WriteFM2

; a = count * 2 - 2
; hl = sound data
MSXAudioZ80_WriteFM1:
	add a,02H
	ld b,a
	ld c,MSXAudio_FM_DATA
MSXAudioZ80_WriteFM1_Loop:
	dec c
	outi
	inc c
	outi
	push hl
	dec hl
	ld a,(hl)
	dec hl
	ld l,(hl)
	ld h,MSXAudio_registerMirrors >> 8
	ld (hl),a
	pop hl
	jp nz,MSXAudioZ80_WriteFM1_Loop
	jp MSXAudioZ80_Process_Loop

; a = 80H + count * 2 - 2
; hl = sound data
MSXAudioZ80_WriteFM2:
	add a,02H
	ld c,a
	ld b,0
	add hl,bc
	jp MSXAudioZ80_Process_Loop

; a = count * 2 - 2
; hl = sound data
MSXAudioZ80_WriteWave:
	add a,02H
	ld c,a
	ld b,0
	add hl,bc
	jp MSXAudioZ80_Process_Loop

; hl = sound data
MSXAudioZ80_WaitLoad: equ MSXAudioZ80_Process_Loop
	; jp MSXAudioZ80_Process_Loop

; hl = sound data
MSXAudioZ80_WriteMemory:
	inc hl
	inc hl
	inc hl
	ld c,(hl)
	inc hl
	ld b,(hl)
	inc hl
	add hl,bc
	jp MSXAudioZ80_Process_Loop

; hl = sound data
MSXAudioZ80_Jump:
	RePlayer_Jump_M
	jp MSXAudioZ80_Process_Loop

; hl = sound data
; ix = stack pointer
MSXAudioZ80_Call:
	RePlayer_Call_M
	jp MSXAudioZ80_Process_Loop

; hl = sound data
; ix = stack pointer
MSXAudioZ80_Return:
	RePlayer_Return_M
	jp MSXAudioZ80_Process_Loop
