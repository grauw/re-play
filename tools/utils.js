export function peek(array) {
	return array.length > 0 ? array[array.length - 1] : undefined;
}

export class MemoConstructor {
	constructor(type) {
		this.type = type;
		this.map = new Map();
	}

	get(...parameters) {
		let value = this.map;
		for (let i = 0; i < parameters.length; i++) {
			if (!value.has(parameters[i])) {
				value.set(parameters[i], i == parameters.length - 1 ? new this.type(...parameters) : new Map());
			}
			value = value.get(parameters[i]);
		}
		return value;
	}
}
