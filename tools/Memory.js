export class Memory {
	constructor(data) {
		this.data = data;
		this.ranges = new Ranges();
	}

	get(address, mask = 0xFF) {
		return this.data[address] & mask;
	}

	set(address, value, mask = 0xFF) {
		this.data[address] = this.data[address] & ~mask | value & mask;
		this.ranges.add(address);
	}

	setData(address, data) {
		this.data.set(data, address);
		this.ranges.add(address, address + data.length);
	}

	getData(address, endAddress) {
		return this.data.subarray(address, endAddress);
	}

	*getDataRanges(ranges = this.ranges) {
		for (const range of ranges) {
			yield [range, this.getData(range.start, range.end)];
		}
	}
}

export class Ranges {
	constructor(...ranges) {
		this.ranges = ranges;
	}

	[Symbol.iterator]() {
		return this.ranges[Symbol.iterator]();
	}

	add(start, end = start + 1) {
		let startIndex = 0;
		let endIndex = this.ranges.length - 1;
		for (let index = 0; index < this.ranges.length; index++) {
			if (start > this.ranges[index].end) {
				startIndex = index + 1;
			} else {
				break;
			}
		}
		for (let index = this.ranges.length - 1; index >= 0; index--) {
			if (end < this.ranges[index].start) {
				endIndex = index - 1;
			} else {
				break;
			}
		}
		this.ranges.splice(startIndex, endIndex - startIndex + 1, new Range(
			Math.min(start, startIndex >= 0 && startIndex < this.ranges.length ? this.ranges[startIndex].start : 0x400000),
			Math.max(end, endIndex >= 0 && endIndex < this.ranges.length ? this.ranges[endIndex].end : 0)
		));
		return this;
	}

	removeGaps(size) {
		let index = 0;
		while (index < this.ranges.length - 1) {
			if (this.ranges[index + 1].start - this.ranges[index].end <= size) {
				this.ranges.splice(index, 2, new Range(this.ranges[index].start, this.ranges[index + 1].end));
			} else {
				index++;
			}
		}
		return this;
	}

	intersect(other) {
		const ranges = [];
		let thisIndex = 0;
		let otherIndex = 0;
		while (thisIndex < this.ranges.length && otherIndex < other.ranges.length) {
			const thisRange = this.ranges[thisIndex];
			const otherRange = other.ranges[otherIndex];
			const start = Math.max(thisRange.start, otherRange.start);
			const end = Math.min(thisRange.end, otherRange.end);
			if (end > start)
				ranges.push(new Range(start, end));
			if (end >= thisRange.end)
				thisIndex++;
			if (end >= otherRange.end)
				otherIndex++;
		}
		this.ranges = ranges;
		return this;
	}

	toString() {
		return `[${this.ranges.join(", ")}]`;
	}
}

export class Range {
	constructor(start, end) {
		this.start = start;
		this.end = end;
	}

	includes(address) {
		return address >= this.start && address < this.end;
	}

	toString() {
		const hex = value => value.toString(16).toUpperCase();
		return `[${hex(this.start)}, ${hex(this.end)}]`;
	}
}
