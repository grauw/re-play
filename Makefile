.PHONY: all com rom makaimura bubble ds6 yu-no sonyc miwaku multipcm xak dist copy run run2
COPY_TARGET = /Volumes/MSXDOS2

all: makaimura bubble ds6 yu-no sonyc miwaku xak com rom

com: bin gen
	java -jar tools/glass.jar src/COM.asm bin/re-play.com gen/re-play.com.sym

rom: bin gen
	node tools/cli.js res/Sonyc_MS/resources.json gen/rom.rep --set bankSize 16384
	java -jar tools/glass.jar -I gen src/ROM.asm bin/re-play.rom gen/re-play.rom.sym

makaimura: bin
	node tools/cli.js res/Makaimura/resources.json bin/makaimura.rep --set bankSize 16384

bubble: bin
	node tools/cli.js res/Bubble\ Bobble/resources-opl.json bin/bubbopl.rep --set bankSize 16384
	node tools/cli.js res/Bubble\ Bobble/resources-opn.json bin/bubbopn.rep --set bankSize 16384

ds6: bin gen
	node tools/cli.js res/Dragon\ Slayer\ 6/resources.json bin/ds6.rep --set bankSize 16384

yu-no: bin gen
	node tools/cli.js res/YU-NO/resources.json bin/yu-no.rep --set bankSize 16384

sonyc: bin
	node tools/cli.js res/Sonyc_MS/resources.json bin/sonyc_ms.rep --set bankSize 16384

miwaku: bin
	node tools/cli.js res/Miwaku\ no\ Chousho/resources.json bin/miwaku.rep --set bankSize 16384

xak: bin
	node tools/cli.js res/Xak/resources.json bin/xak.rep --set bankSize 16384

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
	openmsx -machine Panasonic_FS-A1GT -cart bin/re-play.rom -romtype ASCII16 -ext slotexpander -ext Yamaha_SFG-05 -ext moonsound -script openmsx.tcl

run3:
	openmsx -machine Sony_HB-F1XD -ext slotexpander -ext ide -ext ram4mb -ext Yamaha_SFG-05 -ext moonsound -ext fmpac -script openmsx.tcl
