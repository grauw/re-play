.PHONY: all com rom makaimura sonyc miwaku multipcm dist copy run run2
COPY_TARGET = /Volumes/MSXDOS2

all: makaimura sonyc miwaku com rom

com: bin
	java -jar tools/glass.jar src/COM.asm bin/re-play.com bin/re-play.com.sym

rom: bin gen
	node tools/cli.js res/Sonyc_MS/resources.json gen/rom.rep --set bankSize 8192
	java -jar tools/glass.jar -I gen src/ROM.asm bin/re-play.rom bin/re-play.rom.sym

makaimura: bin
	node tools/cli.js res/Makaimura/resources.json bin/makaimura.rep --set bankSize 16384

sonyc: bin
	node tools/cli.js res/Sonyc_MS/resources.json bin/sonyc_ms.rep --set bankSize 16384

miwaku: bin
	node tools/cli.js res/Miwaku\ no\ Chousho/resources.json bin/miwaku.rep --set bankSize 16384

multipcm: gen
	mkdir -p gen/Daytona\ USA gen/Desert\ Tank gen/Hard\ Dunk gen/Stadium\ Cross gen/Title\ Fight gen/Virtua\ Cop gen/Wing\ War
	node tools/cli.js res/MultiPCM/Daytona\ USA/resources.json gen/Daytona\ USA/
	node tools/cli.js res/MultiPCM/Desert\ Tank/resources.json gen/Desert\ Tank/
	node tools/cli.js res/MultiPCM/Hard\ Dunk/resources.json gen/Hard\ Dunk/
	node tools/cli.js res/MultiPCM/Stadium\ Cross/resources.json gen/Stadium\ Cross/
	node tools/cli.js res/MultiPCM/Title\ Fight/resources.json gen/Title\ Fight/
	node tools/cli.js res/MultiPCM/Virtua\ Cop/resources.json gen/Virtua\ Cop/
	node tools/cli.js res/MultiPCM/Wing\ War/resources.json gen/Wing\ War/

bin:
	mkdir -p bin

gen:
	mkdir -p gen

node_modules: package.json
	npm install
	touch -c -m node_modules

dist:
	rm -f bin/re-play.zip
	zip -j bin/re-play.zip bin/re-play.com LICENSE README.md

copy:
	cp bin/re-play.com $(COPY_TARGET)/re-play/
	cp bin/*.rep $(COPY_TARGET)/re-play/
	diskutil umount $(COPY_TARGET)

run:
	openmsx -machine Panasonic_FS-A1GT -ext slotexpander -ext ide -ext ram4mb -ext Yamaha_SFG-05 -ext moonsound -script openmsx.tcl

run2:
	openmsx -machine Panasonic_FS-A1GT -cart bin/re-play.rom -romtype ASCII8 -ext slotexpander -ext Yamaha_SFG-05 -ext moonsound -script openmsx.tcl
