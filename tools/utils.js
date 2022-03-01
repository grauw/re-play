import { createHash } from "crypto";

export function peek(array) {
	return array.length > 0 ? array[array.length - 1] : undefined;
}

export function rangeMap(count, callback) {
	const array = [];
	for (let i = 0; i < count; i++)
		array.push(callback(i));
	return array;
}

export class MemoConstructor {
	constructor(type) {
		this.type = type;
		this.map = new Map();
	}

	get(...parameters) {
		let value = this.map;
		for (let i = 0; i < parameters.length; i++) {
			const parameter = parameters[i] instanceof Hash ? parameters[i].getHash() : parameters[i];
			if (!value.has(parameter)) {
				value.set(parameter, i == parameters.length - 1 ? new this.type(...parameters) : new Map());
			}
			value = value.get(parameter);
		}
		return value;
	}
}

export class Hash {
	getHash() {
		throw new Error("Not implemented.");
	}
}

export class HashTypedArray extends Hash {
	constructor(array) {
		super();
		this.array = array;
	}

	getHash() {
		const hash = createHash("sha1");
		hash.update(this.array);
		return hash.digest("hex");
	}
}
