import { createHash } from "crypto";

export function bin(value: number, padding = 0) {
	return value.toString(2).toUpperCase().padStart(padding, "0");
}

export function dec(value: number, padding = 0) {
	return value.toString(10).toUpperCase().padStart(padding, "0");
}

export function hex(value: number, padding = 0) {
	return value.toString(16).toUpperCase().padStart(padding, "0");
}

export function rangeMap<T>(count: number, callback: (index: number) => T): T[] {
	const array: T[] = [];
	for (let i = 0; i < count; i++)
		array.push(callback(i));
	return array;
}

export class MemoConstructor<T extends new (...args: any) => any> {
	private type: T;
	private map: Map<any, any>;

	constructor(type: T) {
		this.type = type;
		this.map = new Map();
	}

	get(...parameters: ConstructorParameters<T>): InstanceType<T> {
		let value: any = this.map;
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
	getHash(): unknown {
		throw new Error("Not implemented.");
	}
}

export class HashTypedArray extends Hash {
	public readonly array: Uint8Array;

	constructor(array: Uint8Array) {
		super();
		this.array = array;
	}

	getHash() {
		const hash = createHash("sha1");
		hash.update(this.array);
		return hash.digest("hex");
	}
}
