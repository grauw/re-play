COPY_TARGET = /Volumes/MSXDOS2

all: #node_modules
	mkdir -p bin
	node --unhandled-rejections=strict tools/Resources.js res/Makaimura/resources.json bin/makaimura.rep
	java -jar tools/glass.jar src/COM.asm bin/re-play.com bin/re-play.sym

node_modules: package.json
	npm install
	touch -c -m node_modules

dist: all
	rm -f bin/re-play.zip
	zip -j bin/re-play.zip bin/re-play.com LICENSE README.md

copy: all
	cp bin/re-play.com $(COPY_TARGET)/re-play/
	cp bin/*.rep $(COPY_TARGET)/re-play/
	diskutil umount $(COPY_TARGET)

run: all
	openmsx -machine Panasonic_FS-A1GT -ext slotexpander -ext ide -ext ram4mb -ext Yamaha_SFG-05 -script openmsx.tcl
