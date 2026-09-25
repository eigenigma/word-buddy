import { describe, expect, it } from "vitest";

import { compareCodePoints } from "./compare";

const PRIVATE_USE_START = String.fromCodePoint(0xe000);
const BMP_LAST = String.fromCodePoint(0xffff);
const ASTRAL_FIRST = String.fromCodePoint(0x10000);
const LONE_HIGH_SURROGATE = String.fromCharCode(0xd800);

describe("compareCodePoints", () => {
	it("sorts astral characters after the top of the BMP", () => {
		expect(
			[ASTRAL_FIRST, BMP_LAST, PRIVATE_USE_START, "z"].sort(compareCodePoints),
		).toEqual(["z", PRIVATE_USE_START, BMP_LAST, ASTRAL_FIRST]);
	});

	it("orders a shared prefix before its extensions and ties equal strings", () => {
		expect(compareCodePoints("run", "running")).toBeLessThan(0);
		expect(compareCodePoints("running", "run")).toBeGreaterThan(0);
		expect(compareCodePoints("run", "run")).toBe(0);
	});

	it("compares a lone surrogate by its own code unit", () => {
		expect(
			compareCodePoints(LONE_HIGH_SURROGATE, PRIVATE_USE_START),
		).toBeLessThan(0);
		expect(compareCodePoints(LONE_HIGH_SURROGATE, ASTRAL_FIRST)).toBeLessThan(
			0,
		);
	});
});
