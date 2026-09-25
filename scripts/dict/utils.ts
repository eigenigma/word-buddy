import { createHash } from "node:crypto";

import { compareCodePoints } from "../../src/shared/utils/compare";

export const QUALITY_SIGNAL_FIELDS = [
	"bnc",
	"frq",
	"collins",
	"oxford",
] as const;

export function normalizeText(value: string | null | undefined): string | null {
	const normalizedValue = value?.trim();

	if (!normalizedValue) {
		return null;
	}

	return normalizedValue.replaceAll("\r\n", "\n");
}

export function parseInteger(value: string | null): number | null {
	if (!value) {
		return null;
	}

	const normalizedValue = value.trim();

	if (!normalizedValue) {
		return null;
	}

	const parsedValue = Number.parseInt(normalizedValue, 10);

	return Number.isNaN(parsedValue) ? null : parsedValue;
}

export function sortStrings(values: Iterable<string>): readonly string[] {
	return [...new Set(values)].sort(compareCodePoints);
}

export function sha256Hex(content: string | Uint8Array): string {
	return createHash("sha256").update(content).digest("hex");
}
