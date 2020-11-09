export function toAsmHex(value) {
	const hex = value.toString(16).toUpperCase();
	return hex.charCodeAt(0) > 64 ? `0${hex}H` : `${hex}H`;
}

/**
 * Type checker, intended for use at the start of any function.
 * Primitive types are checked by a string, objects by their constructor.
 * Use an array to denote optionality. Example:
 *
 * function myFunction(aNumber, aFunction, anOptionalString) {
 *     checkTypes(arguments, "number", Function, ["string"])
 * }
 *
 * @param {Array} args An array-like list of arguments.
 * @param {string|Function|Array} types... The types to check against.
 */
export function checkTypes(args) {
	for (let i = 1; i < arguments.length; i++) {
		let type = arguments[i], arg = args[i - 1];
		if (!(type instanceof Array && (type = type[0]) && arg == null) &&
				!(typeof type == "string" && typeof arg == type && arg == arg) &&
				!(type instanceof Function && arg instanceof type)) {
			if (typeof type != "string" && !(type instanceof Function))
				throw new Error(`Unsupported type ${type}.`);
			throw new Error(`Argument of type ${typeof type != "string" && type.constructor.name || type} expected at index ${i - 1}. ` +
					`Was: ${arg && typeof arg != "string" && arg.constructor && arg.constructor.name || arg}.`);
		}
	}
}

export function peek(array) {
	return array.length > 0 ? array[array.length - 1] : undefined;
}

export class MemoConstructor {
	constructor(type) {
		checkTypes(arguments, Function);
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
