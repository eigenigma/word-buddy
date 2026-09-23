import { assert, beforeEach, describe, expect, it, vi } from "vitest";

import type { LemmaExpansionServiceDependencies } from "@/background/dictionary/lemmaExpansionService";
import type { DictionaryQueryServiceDependencies } from "@/background/dictionary/queryService";
import type { DictionarySeedServiceDependencies } from "@/background/dictionary/seed";
import type { DictionaryEntry, LemmaEntry } from "@/shared/dictionary/types";

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

const TEST_LEMMA_ENTRY: LemmaEntry = {
	lemma: "agenda",
	surface: "agendas",
};

const {
	DICTIONARY_QUERY_SERVICE,
	DICTIONARY_SEED_SERVICE,
	DICTIONARY_SEED_STORAGE,
	LEMMA_EXPANSION_SERVICE,
	createDictionaryQueryServiceMock,
	createDictionarySeedServiceMock,
	createLemmaExpansionServiceMock,
	staticDictionaryDbMock,
} = vi.hoisted(() => ({
	DICTIONARY_QUERY_SERVICE: { id: "dictionary-query-service" },
	DICTIONARY_SEED_SERVICE: { id: "dictionary-seed-service" },
	DICTIONARY_SEED_STORAGE: { id: "seed-storage" },
	LEMMA_EXPANSION_SERVICE: { id: "lemma-expansion-service" },
	createDictionaryQueryServiceMock:
		vi.fn<(dependencies: DictionaryQueryServiceDependencies) => unknown>(),
	createDictionarySeedServiceMock:
		vi.fn<(dependencies: DictionarySeedServiceDependencies) => unknown>(),
	createLemmaExpansionServiceMock:
		vi.fn<(dependencies: LemmaExpansionServiceDependencies) => unknown>(),
	staticDictionaryDbMock: {
		dict: {
			bulkPut: vi.fn(),
			clear: vi.fn(),
			count: vi.fn(),
			get: vi.fn(),
		},
		lemma: {
			bulkPut: vi.fn(),
			clear: vi.fn(),
			count: vi.fn(),
			get: vi.fn(),
			toArray: vi.fn(),
		},
		transaction: vi.fn(async (...args: unknown[]): Promise<unknown> => {
			const callback = args.at(-1);
			if (typeof callback !== "function") {
				throw new Error("Missing transaction callback");
			}
			return await callback();
		}),
	},
}));

vi.mock("@/background/dictionary/assets", () => ({
	loadDictionarySeedAssets: vi.fn(),
	loadDictionarySeedManifest: vi.fn(),
}));
vi.mock("@/background/dictionary/database", () => ({
	STATIC_DICTIONARY_DB_SCHEMA_VERSION: 1,
	staticDictionaryDb: staticDictionaryDbMock,
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

function resetDictionaryMocks(): void {
	createDictionaryQueryServiceMock.mockReset();
	createDictionarySeedServiceMock.mockReset();
	createLemmaExpansionServiceMock.mockReset();
	staticDictionaryDbMock.dict.bulkPut.mockReset();
	staticDictionaryDbMock.dict.clear.mockReset();
	staticDictionaryDbMock.dict.count.mockReset();
	staticDictionaryDbMock.dict.get.mockReset();
	staticDictionaryDbMock.lemma.bulkPut.mockReset();
	staticDictionaryDbMock.lemma.clear.mockReset();
	staticDictionaryDbMock.lemma.count.mockReset();
	staticDictionaryDbMock.lemma.get.mockReset();
	staticDictionaryDbMock.lemma.toArray.mockReset();
	staticDictionaryDbMock.transaction.mockClear();
}

beforeEach(() => {
	resetDictionaryMocks();
	createDictionaryQueryServiceMock.mockReturnValue(DICTIONARY_QUERY_SERVICE);
	createDictionarySeedServiceMock.mockReturnValue(DICTIONARY_SEED_SERVICE);
	createLemmaExpansionServiceMock.mockReturnValue(LEMMA_EXPANSION_SERVICE);
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

describe("dictionary query wiring", () => {
	it("routes lookups through staticDictionaryDb", async () => {
		staticDictionaryDbMock.dict.get.mockResolvedValue(TEST_DICT_ENTRY);
		staticDictionaryDbMock.lemma.get.mockResolvedValue({ lemma: "agenda" });
		createDictionaryBrowserAdapter();

		const dependencies = createDictionaryQueryServiceMock.mock.lastCall?.[0];
		assert.isDefined(dependencies);

		await expect(
			dependencies.dictRepository.getByWord("agenda"),
		).resolves.toEqual(TEST_DICT_ENTRY);
		await expect(
			dependencies.lemmaRepository.getBySurface("agendas"),
		).resolves.toBe("agenda");
		expect(staticDictionaryDbMock.dict.get).toHaveBeenCalledWith("agenda");
		expect(staticDictionaryDbMock.lemma.get).toHaveBeenCalledWith("agendas");
	});
});

describe("dictionary seed wiring", () => {
	it("injects browser seed storage and routes repository writes through staticDictionaryDb transactions", async () => {
		staticDictionaryDbMock.dict.count.mockResolvedValue(1);
		staticDictionaryDbMock.lemma.count.mockResolvedValue(2);
		createDictionaryBrowserAdapter();

		const dependencies = createDictionarySeedServiceMock.mock.lastCall?.[0];
		assert.isDefined(dependencies);

		expect(dependencies.storage).toBe(DICTIONARY_SEED_STORAGE);
		await dependencies.repository.clearAll();
		await expect(dependencies.repository.countDictEntries()).resolves.toBe(1);
		await expect(dependencies.repository.countLemmaEntries()).resolves.toBe(2);
		await dependencies.repository.putDictEntries([TEST_DICT_ENTRY]);
		await dependencies.repository.putLemmaEntries([TEST_LEMMA_ENTRY]);
		expect(staticDictionaryDbMock.dict.clear).toHaveBeenCalledTimes(1);
		expect(staticDictionaryDbMock.lemma.clear).toHaveBeenCalledTimes(1);
		expect(staticDictionaryDbMock.dict.bulkPut).toHaveBeenCalledWith([
			TEST_DICT_ENTRY,
		]);
		expect(staticDictionaryDbMock.lemma.bulkPut).toHaveBeenCalledWith([
			TEST_LEMMA_ENTRY,
		]);
	});
});

describe("lemma expansion wiring", () => {
	it("routes listAll through staticDictionaryDb.lemma.toArray", async () => {
		staticDictionaryDbMock.lemma.toArray.mockResolvedValue([TEST_LEMMA_ENTRY]);
		createDictionaryBrowserAdapter();

		const dependencies = createLemmaExpansionServiceMock.mock.lastCall?.[0];
		assert.isDefined(dependencies);

		await expect(dependencies.repository.listAll()).resolves.toEqual([
			TEST_LEMMA_ENTRY,
		]);
		expect(staticDictionaryDbMock.lemma.toArray).toHaveBeenCalledTimes(1);
	});
});
