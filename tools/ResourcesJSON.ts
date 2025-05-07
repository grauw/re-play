import type { PostTransformOptions, TransformOptions } from "./Format.ts";
import type { TransformOPL4Options } from "./FormatOPL4.ts";
import type { TransformOPLLPSGOptions } from "./FormatOPLLPSG.ts";
import type { TransformOPNOptions } from "./FormatOPN.ts";

export type FormatTypeJSON = "opn" | "opl4" | "opll-psg" | "text" | "text-opn" | "text-opl4" | "text-opll-psg" | "vgm-opm" | "vgm-opnb" | "vgm-opl4" | "vgm-opll-psg";

export type FormatOptionsJSON = {
	bankSize?: number;
	opnbFrequency?: number;
	opmFrequency?: number;
	opl4Frequency?: number;
	opllFrequency?: number;
	psgFrequency?: number;
};

export type FormatJSON = {
	format: FormatTypeJSON;
} & FormatOptionsJSON;

export type TransformOptionsJSON = TransformOptions & TransformOPNOptions & TransformOPL4Options & TransformOPLLPSGOptions & PostTransformOptions;

export type TrackJSON = {
	path: string;
	name?: string;
} & TransformOptionsJSON;

export type ResourcesJSON = FormatJSON & {
	tracks: TrackJSON[];
} & TransformOptionsJSON;
