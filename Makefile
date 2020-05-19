COPY_TARGET = /Volumes/MSXDOS2

all: #node_modules
	mkdir -p bin
	node --unhandled-rejections=strict tools/resources.js res/resources.json
	java -jar tools/glass.jar src/COM.asm bin/gngplay.com bin/gngplay.sym

node_modules: package.json
	npm install
	touch -c -m node_modules

dist: all
	rm -f bin/gngplay.zip
	zip -j bin/gngplay.zip bin/gngplay.com LICENSE README.md

copy: all
	cp bin/gngplay.com $(COPY_TARGET)/gng/
	cp bin/*.gng $(COPY_TARGET)/gng/
	diskutil umount $(COPY_TARGET)

run: all
	openmsx -machine Panasonic_FS-A1GT -ext Yamaha_SFG-05 -diska bin/ -script openmsx.tcl
