import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { staticDictionaryDb } from "@/background/dictionary/database";
import type { LemmaExpansionServiceDependencies } from "@/background/dictionary/lemmaExpansionService";
import type { DictionaryResolveServiceDependencies } from "@/background/dictionary/resolveService";
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
	DICTIONARY_RESOLVE_SERVICE,
	DICTIONARY_SEED_SERVICE,
	DICTIONARY_SEED_STORAGE,
	LEMMA_EXPANSION_SERVICE,
	createDictionaryResolveServiceMock,
	createDictionarySeedServiceMock,
	createLemmaExpansionServiceMock,
} = vi.hoisted(() => ({
	DICTIONARY_RESOLVE_SERVICE: { id: "dictionary-resolve-service" },
	DICTIONARY_SEED_SERVICE: {
		ensureSeeded: vi.fn<() => Promise<void>>(),
		id: "dictionary-seed-service",
	},
	DICTIONARY_SEED_STORAGE: { id: "seed-storage" },
	LEMMA_EXPANSION_SERVICE: { id: "lemma-expansion-service" },
	createDictionaryResolveServiceMock:
		vi.fn<(dependencies: DictionaryResolveServiceDependencies) => unknown>(),
	createDictionarySeedServiceMock:
		vi.fn<(dependencies: DictionarySeedServiceDependencies) => unknown>(),
	createLemmaExpansionServiceMock:
		vi.fn<(dependencies: LemmaExpansionServiceDependencies) => unknown>(),
}));

vi.mock("@/background/dictionary/assets", () => ({
	createDictionaryAssetLoader: (): object => ({
		loadAssets: vi.fn(),
		loadManifest: vi.fn(),
	}),
}));
vi.mock("@/background/dictionary/lemmaExpansionService", () => ({
	createLemmaExpansionService: createLemmaExpansionServiceMock,
}));
vi.mock("@/background/dictionary/resolveService", () => ({
	createDictionaryResolveService: createDictionaryResolveServiceMock,
}));
vi.mock("@/background/dictionary/seed", () => ({
	createDictionarySeedService: createDictionarySeedServiceMock,
}));
vi.mock("@/background/dictionary/storage", () => ({
	createBrowserDictionarySeedStateStorage: (): object =>
		DICTIONARY_SEED_STORAGE,
}));

function captureDependencies(): {
	readonly lemmaExpansion: LemmaExpansionServiceDependencies;
	readonly resolve: DictionaryResolveServiceDependencies;
	readonly seed: DictionarySeedServiceDependencies;
} {
	createDictionaryBrowserAdapter();
	const resolve = createDictionaryResolveServiceMock.mock.lastCall?.[0];
	const lemmaExpansion = createLemmaExpansionServiceMock.mock.lastCall?.[0];
	const seed = createDictionarySeedServiceMock.mock.lastCall?.[0];
	if (
		resolve === undefined ||
		lemmaExpansion === undefined ||
		seed === undefined
	) {
		throw new Error("createDictionaryBrowserAdapter built no services");
	}
	return { lemmaExpansion: lemmaExpansion, resolve: resolve, seed: seed };
}

beforeEach(async () => {
	vi.resetAllMocks();
	createDictionaryResolveServiceMock.mockReturnValue(
		DICTIONARY_RESOLVE_SERVICE,
	);
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
			dictionaryResolveService: DICTIONARY_RESOLVE_SERVICE,
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
		const { lemmaExpansion, resolve } = captureDependencies();

		const pendingEntry = resolve.dictRepository.getByWord("agenda");
		const pendingLemma = resolve.lemmaRepository.getLemmaBySurface("agendas");
		const pendingRows = lemmaExpansion.lemmaRepository.listByLemmas(["agenda"]);
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

	it("serve both lemma directions from one repository and map misses to null", async () => {
		DICTIONARY_SEED_SERVICE.ensureSeeded.mockResolvedValue();
		const { lemmaExpansion, resolve } = captureDependencies();

		expect(lemmaExpansion.lemmaRepository).toBe(resolve.lemmaRepository);
		await expect(
			resolve.dictRepository.getByWord("missing"),
		).resolves.toBeNull();
		await expect(
			resolve.lemmaRepository.getLemmaBySurface("missing"),
		).resolves.toBeNull();
	});

	it("reject with the seed error without touching staticDictionaryDb", async () => {
		const seedError = new Error("seed failed");
		DICTIONARY_SEED_SERVICE.ensureSeeded.mockRejectedValue(seedError);
		const staticReads = spyOnStaticReads();
		const { lemmaExpansion, resolve } = captureDependencies();

		await expect(resolve.dictRepository.getByWord("agenda")).rejects.toBe(
			seedError,
		);
		await expect(
			resolve.lemmaRepository.getLemmaBySurface("agendas"),
		).rejects.toBe(seedError);
		await expect(
			lemmaExpansion.lemmaRepository.listByLemmas(["agenda"]),
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

	it("writes and clears rows in staticDictionaryDb", async () => {
		const { repository } = captureDependencies().seed;

		await repository.putDictEntries([TEST_DICT_ENTRY]);
		await repository.putLemmaEntries([AGENDA_LEMMA_ENTRY, RUN_LEMMA_ENTRY]);
		await expect(staticDictionaryDb.dict.count()).resolves.toBe(1);
		await expect(staticDictionaryDb.lemma.count()).resolves.toBe(2);
		await expect(repository.isPopulated()).resolves.toBe(true);

		await repository.clearAll();
		await expect(staticDictionaryDb.dict.count()).resolves.toBe(0);
		await expect(staticDictionaryDb.lemma.count()).resolves.toBe(0);
		await expect(repository.isPopulated()).resolves.toBe(false);
	});

	it("reports the tables unpopulated while any of them is empty", async () => {
		const { repository } = captureDependencies().seed;

		await repository.putDictEntries([TEST_DICT_ENTRY]);

		await expect(repository.isPopulated()).resolves.toBe(false);
	});
});
