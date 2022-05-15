;
;
;
	INCLUDE "MoonSound.asm"
	INCLUDE "MoonSoundZ80.asm"
	; INCLUDE "MSXAudio.asm"
	; INCLUDE "MSXAudioZ80.asm"

FormatOPL4_ID: equ 1

FormatOPL4_Detect:
	call MoonSoundZ80_Detect
	ld hl,MoonSoundZ80_JumpTable
	ret c
	call MoonSound_Detect
	ld hl,MoonSound_JumpTable
	; ret c
	; call MSXAudioZ80_Detect
	; ld hl,MSXAudioZ80_JumpTable
	; ret c
	; call MSXAudio_Detect
	; ld hl,MSXAudio_JumpTable
	ret
