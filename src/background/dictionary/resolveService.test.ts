import { describe, expect, it, vi } from "vitest";

import type { DictionaryEntry } from "@/shared/dictionary/types";

import {
	createDictionaryResolveService,
	type DictionaryResolveService,
} from "./resolveService";

function createEntry(word: string): DictionaryEntry {
	return {
		definition: null,
		frequency: {
			bnc: null,
			collins: null,
			frq: null,
			oxford: false,
			tags: [],
		},
		morphology: {
			exchange: {},
		},
		phonetic: null,
		pos: null,
		translation: `${word} (translation)`,
		word: word,
	};
}

function createFixtureService(
	words: readonly string[],
	lemmaBySurface: ReadonlyMap<string, string> = new Map(),
): {
	readonly getByWord: ReturnType<
		typeof vi.fn<(word: string) => Promise<DictionaryEntry | null>>
	>;
	readonly getLemmaBySurface: ReturnType<
		typeof vi.fn<(surface: string) => Promise<string | null>>
	>;
	readonly service: DictionaryResolveService;
} {
	const entries = new Map(
		words.map((word: string) => [word, createEntry(word)] as const),
	);
	const getByWord = vi.fn(
		async (word: string): Promise<DictionaryEntry | null> =>
			entries.get(word) ?? null,
	);
	const getLemmaBySurface = vi.fn(
		async (surface: string): Promise<string | null> =>
			lemmaBySurface.get(surface) ?? null,
	);

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
			new Map([["running", "run"]]),
		);

		await expect(service.resolve("Running")).resolves.toEqual({
			entry: createEntry("running"),
			lemma: "running",
		});
		expect(getLemmaBySurface).not.toHaveBeenCalled();
	});

	it("falls back to the lemma mapping and the lemma's entry", async () => {
		const { service } = createFixtureService(["go"], new Map([["went", "go"]]));

		await expect(service.resolve(" Went ")).resolves.toEqual({
			entry: createEntry("go"),
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
			new Map([["went", "go"]]),
		);

		await service.resolve("went");

		expect(getByWord.mock.calls).toEqual([["went"], ["go"]]);
	});
});

describe("resolve normalization", () => {
	it("collapses whitespace inside a phrase for the entry lookup", async () => {
		const { getByWord, service } = createFixtureService(["ice cream"]);

		await expect(service.resolve(" Ice \n\t Cream ")).resolves.toEqual({
			entry: createEntry("ice cream"),
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
