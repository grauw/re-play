"use strict"

function toAsmHex(value) {
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
function checkTypes(args) {
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

exports.checkTypes = checkTypes;
exports.toAsmHex = toAsmHex;
