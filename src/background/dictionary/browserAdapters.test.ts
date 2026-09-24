import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { staticDictionaryDb } from "@/background/dictionary/database";
import type { LemmaExpansionServiceDependencies } from "@/background/dictionary/lemmaExpansionService";
import type { DictionaryQueryServiceDependencies } from "@/background/dictionary/queryService";
import type { DictionarySeedServiceDependencies } from "@/background/dictionary/seed";
import type { DictionaryEntry, LemmaEntry } from "@/shared/dictionary/types";
import { sleep } from "@/shared/utils/async";

import { createDictionaryBrowserAdapter } from "./browserAdapters";

const TEST_DICT_ENTRY: DictionaryEntry = {
	definition: "meeting plan",
	frequency: {
		bnc: 1,
		collins: 1,
		frq: 1,
		oxford: true,
		tags: ["bnc"],
	},
	morphology: {
		exchange: {},
	},
	phonetic: null,
	pos: "n.",
	translation: "议程",
	word: "agenda",
};

const AGENDA_LEMMA_ENTRY: LemmaEntry = {
	lemma: "agenda",
	surface: "agendas",
};

const RUN_LEMMA_ENTRY: LemmaEntry = {
	lemma: "run",
	surface: "ran",
};

const {
	DICTIONARY_QUERY_SERVICE,
	DICTIONARY_SEED_SERVICE,
	DICTIONARY_SEED_STORAGE,
	LEMMA_EXPANSION_SERVICE,
	createDictionaryQueryServiceMock,
	createDictionarySeedServiceMock,
	createLemmaExpansionServiceMock,
} = vi.hoisted(() => ({
	DICTIONARY_QUERY_SERVICE: { id: "dictionary-query-service" },
	DICTIONARY_SEED_SERVICE: {
		ensureSeeded: vi.fn<() => Promise<void>>(),
		id: "dictionary-seed-service",
	},
	DICTIONARY_SEED_STORAGE: { id: "seed-storage" },
	LEMMA_EXPANSION_SERVICE: { id: "lemma-expansion-service" },
	createDictionaryQueryServiceMock:
		vi.fn<(dependencies: DictionaryQueryServiceDependencies) => unknown>(),
	createDictionarySeedServiceMock:
		vi.fn<(dependencies: DictionarySeedServiceDependencies) => unknown>(),
	createLemmaExpansionServiceMock:
		vi.fn<(dependencies: LemmaExpansionServiceDependencies) => unknown>(),
}));

vi.mock("@/background/dictionary/assets", () => ({
	loadDictionarySeedAssets: vi.fn(),
	loadDictionarySeedManifest: vi.fn(),
}));
vi.mock("@/background/dictionary/lemmaExpansionService", () => ({
	createLemmaExpansionService: createLemmaExpansionServiceMock,
}));
vi.mock("@/background/dictionary/queryService", () => ({
	createDictionaryQueryService: createDictionaryQueryServiceMock,
}));
vi.mock("@/background/dictionary/seed", () => ({
	createBrowserDictionarySeedStateStorage: (): object =>
		DICTIONARY_SEED_STORAGE,
	createDictionarySeedService: createDictionarySeedServiceMock,
}));

function captureDependencies(): {
	readonly lemmaExpansion: LemmaExpansionServiceDependencies;
	readonly query: DictionaryQueryServiceDependencies;
	readonly seed: DictionarySeedServiceDependencies;
} {
	createDictionaryBrowserAdapter();
	const query = createDictionaryQueryServiceMock.mock.lastCall?.[0];
	const lemmaExpansion = createLemmaExpansionServiceMock.mock.lastCall?.[0];
	const seed = createDictionarySeedServiceMock.mock.lastCall?.[0];
	if (
		query === undefined ||
		lemmaExpansion === undefined ||
		seed === undefined
	) {
		throw new Error("createDictionaryBrowserAdapter built no services");
	}
	return { lemmaExpansion: lemmaExpansion, query: query, seed: seed };
}

beforeEach(async () => {
	vi.resetAllMocks();
	createDictionaryQueryServiceMock.mockReturnValue(DICTIONARY_QUERY_SERVICE);
	createDictionarySeedServiceMock.mockReturnValue(DICTIONARY_SEED_SERVICE);
	createLemmaExpansionServiceMock.mockReturnValue(LEMMA_EXPANSION_SERVICE);
	await Promise.all([
		staticDictionaryDb.dict.clear(),
		staticDictionaryDb.lemma.clear(),
	]);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("createDictionaryBrowserAdapter", () => {
	it("returns the three dictionary services", () => {
		const adapter = createDictionaryBrowserAdapter();

		expect(adapter).toEqual({
			dictionaryQueryService: DICTIONARY_QUERY_SERVICE,
			dictionarySeedService: DICTIONARY_SEED_SERVICE,
			lemmaExpansionService: LEMMA_EXPANSION_SERVICE,
		});
	});
});

describe("seeded dictionary reads", () => {
	function spyOnStaticReads(): readonly unknown[] {
		return [
			vi.spyOn(staticDictionaryDb.dict, "get"),
			vi.spyOn(staticDictionaryDb.lemma, "get"),
			vi.spyOn(staticDictionaryDb.lemma, "where"),
		];
	}

	beforeEach(async () => {
		await staticDictionaryDb.dict.put(TEST_DICT_ENTRY);
		await staticDictionaryDb.lemma.bulkPut([
			AGENDA_LEMMA_ENTRY,
			RUN_LEMMA_ENTRY,
		]);
	});

	it("touch staticDictionaryDb only after the adapter's seed service finishes", async () => {
		const seed = Promise.withResolvers<void>();
		DICTIONARY_SEED_SERVICE.ensureSeeded.mockReturnValue(seed.promise);
		const staticReads = spyOnStaticReads();
		const { lemmaExpansion, query } = captureDependencies();

		const pendingEntry = query.dictRepository.getByWord("agenda");
		const pendingLemma = query.lemmaRepository.getBySurface("agendas");
		const pendingRows = lemmaExpansion.repository.listByLemmas(["agenda"]);
		await sleep(0);
		for (const staticRead of staticReads) {
			expect(staticRead).not.toHaveBeenCalled();
		}

		seed.resolve();
		await expect(pendingEntry).resolves.toEqual(TEST_DICT_ENTRY);
		await expect(pendingLemma).resolves.toBe("agenda");
		await expect(pendingRows).resolves.toEqual([AGENDA_LEMMA_ENTRY]);
		for (const staticRead of staticReads) {
			expect(staticRead).toHaveBeenCalled();
		}
		expect(createDictionarySeedServiceMock).toHaveBeenCalledTimes(1);
	});

	it("reject with the seed error without touching staticDictionaryDb", async () => {
		const seedError = new Error("seed failed");
		DICTIONARY_SEED_SERVICE.ensureSeeded.mockRejectedValue(seedError);
		const staticReads = spyOnStaticReads();
		const { lemmaExpansion, query } = captureDependencies();

		await expect(query.dictRepository.getByWord("agenda")).rejects.toBe(
			seedError,
		);
		await expect(query.lemmaRepository.getBySurface("agendas")).rejects.toBe(
			seedError,
		);
		await expect(
			lemmaExpansion.repository.listByLemmas(["agenda"]),
		).rejects.toBe(seedError);
		for (const staticRead of staticReads) {
			expect(staticRead).not.toHaveBeenCalled();
		}
	});
});

describe("dictionary seed wiring", () => {
	it("injects browser seed storage", () => {
		const { seed } = captureDependencies();

		expect(seed.storage).toBe(DICTIONARY_SEED_STORAGE);
	});

	it("writes, counts, and clears rows in staticDictionaryDb", async () => {
		const { repository } = captureDependencies().seed;

		await repository.putDictEntries([TEST_DICT_ENTRY]);
		await repository.putLemmaEntries([AGENDA_LEMMA_ENTRY, RUN_LEMMA_ENTRY]);
		await expect(repository.countDictEntries()).resolves.toBe(1);
		await expect(repository.countLemmaEntries()).resolves.toBe(2);

		await repository.clearAll();
		await expect(repository.countDictEntries()).resolves.toBe(0);
		await expect(repository.countLemmaEntries()).resolves.toBe(0);
	});
});
