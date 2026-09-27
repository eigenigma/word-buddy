import { describe, expect, it } from "vitest";

import { computeTranslationHash } from "./hash";

describe("computeTranslationHash", () => {
	it("computes stable hashes regardless of word order", async () => {
		const firstHash = await computeTranslationHash(
			"model-a",
			"What is on the agenda today?",
			["agenda", "today"],
		);
		const secondHash = await computeTranslationHash(
			"model-a",
			"What is on the agenda today?",
			["agenda", "today"],
		);
		const reorderedHash = await computeTranslationHash(
			"model-a",
			"What is on the agenda today?",
			["today", "agenda"],
		);
		const changedModelHash = await computeTranslationHash(
			"model-b",
			"What is on the agenda today?",
			["agenda", "today"],
		);

		expect(firstHash).toBe(secondHash);
		expect(firstHash).toBe(reorderedHash);
		expect(firstHash).not.toBe(changedModelHash);
		expect(firstHash).toMatch(/^[0-9a-f]{64}$/u);
	});
});
