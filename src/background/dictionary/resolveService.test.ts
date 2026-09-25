import { describe, expect, it, type Mock, vi } from "vitest";

import type { LemmaEntry } from "@/shared/dictionary/types";
import {
	createInMemoryDictionaryRepositories,
	createTestDictionaryEntry,
} from "@/test-helpers/dictionaryFixtures";

import type {
	DictionaryEntryRepository,
	LemmaRepository,
} from "./repositories";
import {
	createDictionaryResolveService,
	type DictionaryResolveService,
} from "./resolveService";

function createFixtureService(
	words: readonly string[],
	lemmaEntries: readonly LemmaEntry[] = [],
): {
	readonly getByWord: Mock<DictionaryEntryRepository["getByWord"]>;
	readonly getLemmaBySurface: Mock<LemmaRepository["getLemmaBySurface"]>;
	readonly service: DictionaryResolveService;
} {
	const { dictRepository, lemmaRepository } =
		createInMemoryDictionaryRepositories({
			dictEntries: words.map((word) => createTestDictionaryEntry(word)),
			lemmaEntries: lemmaEntries,
		});
	const getByWord = vi.fn(dictRepository.getByWord);
	const getLemmaBySurface = vi.fn(lemmaRepository.getLemmaBySurface);

	return {
		getByWord: getByWord,
		getLemmaBySurface: getLemmaBySurface,
		service: createDictionaryResolveService({
			dictRepository: { getByWord: getByWord },
			lemmaRepository: { getLemmaBySurface: getLemmaBySurface },
		}),
	};
}

describe("resolve precedence", () => {
	it("prefers an exact entry over the lemma mapping", async () => {
		const { getLemmaBySurface, service } = createFixtureService(
			["run", "running"],
			[{ lemma: "run", surface: "running" }],
		);

		await expect(service.resolve("Running")).resolves.toEqual({
			entry: createTestDictionaryEntry("running"),
			lemma: "running",
		});
		expect(getLemmaBySurface).not.toHaveBeenCalled();
	});

	it("falls back to the lemma mapping and the lemma's entry", async () => {
		const { service } = createFixtureService(
			["go"],
			[{ lemma: "go", surface: "went" }],
		);

		await expect(service.resolve(" Went ")).resolves.toEqual({
			entry: createTestDictionaryEntry("go"),
			lemma: "go",
		});
	});

	it("falls back to the trimmed, lowercased selection without an entry", async () => {
		const { service } = createFixtureService([]);

		await expect(service.resolve("  Zyx ")).resolves.toEqual({
			entry: null,
			lemma: "zyx",
		});
	});

	it("keeps a non-lexical selection as its lemma without reading anything", async () => {
		const { getByWord, getLemmaBySurface, service } = createFixtureService([]);

		await expect(service.resolve("Café")).resolves.toEqual({
			entry: null,
			lemma: "café",
		});
		expect(getByWord).not.toHaveBeenCalled();
		expect(getLemmaBySurface).not.toHaveBeenCalled();
	});

	it("resolves a blank selection to null without reading anything", async () => {
		const { getByWord, getLemmaBySurface, service } = createFixtureService([]);

		await expect(service.resolve(" \n ")).resolves.toBeNull();
		expect(getByWord).not.toHaveBeenCalled();
		expect(getLemmaBySurface).not.toHaveBeenCalled();
	});
});

describe("resolve reads", () => {
	it("reads the dictionary once on a total miss", async () => {
		const { getByWord, getLemmaBySurface, service } = createFixtureService([]);

		await service.resolve("Zyx");

		expect(getByWord.mock.calls).toEqual([["zyx"]]);
		expect(getLemmaBySurface.mock.calls).toEqual([["zyx"]]);
	});

	it("reads each distinct key once when a lemma mapping exists", async () => {
		const { getByWord, service } = createFixtureService(
			["go"],
			[{ lemma: "go", surface: "went" }],
		);

		await service.resolve("went");

		expect(getByWord.mock.calls).toEqual([["went"], ["go"]]);
	});
});

describe("resolve normalization", () => {
	it("collapses whitespace inside a phrase for the entry lookup", async () => {
		const { getByWord, service } = createFixtureService(["ice cream"]);

		await expect(service.resolve(" Ice \n\t Cream ")).resolves.toEqual({
			entry: createTestDictionaryEntry("ice cream"),
			lemma: "ice cream",
		});
		expect(getByWord.mock.calls).toEqual([["ice cream"]]);
	});

	it("sends only single words to the lemma table", async () => {
		const { getLemmaBySurface, service } = createFixtureService([]);

		await expect(service.resolve("Give up")).resolves.toEqual({
			entry: null,
			lemma: "give up",
		});
		expect(getLemmaBySurface).not.toHaveBeenCalled();
	});
});
