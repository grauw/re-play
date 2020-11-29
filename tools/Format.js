import { checkTypes } from "./utils.js";

export class Format {
	constructor(name, path) {
		checkTypes(arguments, "string", "string");
		this.name = name;
		this.path = path;
	}
}
