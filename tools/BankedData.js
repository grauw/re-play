class Rewrite {
	constructor(target, position) {
		this.target = target;
		this.position = position;
	}
}

export class BankedData {
	constructor(bankSize = -1, jump) {
		if (bankSize & bankSize - 1)
			throw new Error("Bank size must be a power of two.");
		this.data = [];
		this.rewrites = [];
		this.symbols = new Map();
		this.bankSize = bankSize;
		this.jump = jump;
	}

	get bank() {
		return Math.floor(this.data.length / this.bankSize);
	}

	get free() {
		return this.bankSize - (this.data.length % this.bankSize);
	}

	add(...values) {
		this.addArray(values);
	}

	addArray(values) {
		if (this.free - values.length < this.jump.length) {
			const target = `bank${this.bank + 1}`;
			this.data.push(...this.jump);
			this.addRewrite(target);
			this.data.push(...Array(this.free % this.bankSize).fill(0));
			this.addSymbol(target);
		}
		for (const value of values) {
			this.data.push(value);
		}
	}

	addRewrite(target) {
		this.rewrites.push(new Rewrite(target, this.data.length - 3));
	}

	addSymbol(name) {
		if (this.symbols.has(name)) {
			throw new Error(`Symbol already exists: ${name}`);
		}
		this.symbols.set(name, this.data.length);
	}

	getData() {
		for (const rewrite of this.rewrites) {
			const source = rewrite.position;
			const target = this.symbols.get(rewrite.target);
			const addressOffset = (target % this.bankSize) - ((source % this.bankSize) + 3);
			const bankOffset = Math.floor(target / this.bankSize) - Math.floor(source / this.bankSize);
			this.data[rewrite.position + 0] = (addressOffset >> 0) & 0xFF;
			this.data[rewrite.position + 1] = (addressOffset >> 8) & 0xFF;
			this.data[rewrite.position + 2] = bankOffset & 0xFF;
		}
		return this.data;
	}
}
