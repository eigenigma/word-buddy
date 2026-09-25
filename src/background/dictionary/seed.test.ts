import { describe, expect, it } from "vitest";

import type {
	DictionaryEntry,
	LemmaEntry,
} from "../../shared/dictionary/types";
import { createTestDictionaryEntry } from "../../test-helpers/dictionaryFixtures";
import { TEST_DICTIONARY_METADATA } from "../../test-helpers/dictionaryMetadata";

import {
	type DictionarySeedAssets,
	type DictionarySeedManifest,
	SEED_FORMAT_VERSION,
} from "./assets";
import {
	createDictionarySeedService,
	type DictionarySeedRepository,
	type DictionarySeedService,
	type DictionarySeedState,
	type DictionarySeedStateStorage,
} from "./seed";

const TEST_MANIFEST: DictionarySeedManifest = {
	assetFingerprint: "asset-fingerprint",
	metadata: TEST_DICTIONARY_METADATA,
};

const TEST_DICT_ENTRIES: readonly DictionaryEntry[] = [
	createTestDictionaryEntry("agenda"),
];

const TEST_LEMMA_ENTRIES: readonly LemmaEntry[] = [
	{
		lemma: "agenda",
		surface: "agendas",
	},
];

const TEST_ASSETS: DictionarySeedAssets = {
	dictEntries: TEST_DICT_ENTRIES,
	lemmaEntries: TEST_LEMMA_ENTRIES,
};

function createMatchingSeedState(): DictionarySeedState {
	return {
		assetFingerprint: TEST_MANIFEST.assetFingerprint,
		seedFormatVersion: SEED_FORMAT_VERSION,
	};
}

interface InMemoryRepositoryState {
	clearAllCalls: number;
	dictEntries: readonly DictionaryEntry[];
	lemmaEntries: readonly LemmaEntry[];
}

interface InMemorySeedStateStorageState {
	seedState: DictionarySeedState | null;
	writeCalls: number;
}

function createInMemoryRepository(
	initialState: {
		readonly dictEntries?: readonly DictionaryEntry[];
		readonly lemmaEntries?: readonly LemmaEntry[];
	} = {},
): {
	readonly repository: DictionarySeedRepository;
	readonly state: InMemoryRepositoryState;
} {
	const state: InMemoryRepositoryState = {
		clearAllCalls: 0,
		dictEntries: initialState.dictEntries ?? [],
		lemmaEntries: initialState.lemmaEntries ?? [],
	};

	return {
		repository: {
			clearAll: async (): Promise<void> => {
				state.clearAllCalls += 1;
				state.dictEntries = [];
				state.lemmaEntries = [];
			},
			isPopulated: async (): Promise<boolean> =>
				state.dictEntries.length > 0 && state.lemmaEntries.length > 0,
			putDictEntries: async (
				entries: readonly DictionaryEntry[],
			): Promise<void> => {
				state.dictEntries = [...state.dictEntries, ...entries];
			},
			putLemmaEntries: async (
				entries: readonly LemmaEntry[],
			): Promise<void> => {
				state.lemmaEntries = [...state.lemmaEntries, ...entries];
			},
		},
		state: state,
	};
}

function createInMemorySeedStateStorage(
	initialSeedState: DictionarySeedState | null = null,
): {
	readonly state: InMemorySeedStateStorageState;
	readonly storage: DictionarySeedStateStorage;
} {
	const state: InMemorySeedStateStorageState = {
		seedState: initialSeedState,
		writeCalls: 0,
	};

	return {
		state: state,
		storage: {
			clearState: async (): Promise<void> => {
				state.seedState = null;
			},
			readState: async (): Promise<DictionarySeedState | null> =>
				state.seedState,
			writeState: async (seedState: DictionarySeedState): Promise<void> => {
				state.seedState = seedState;
				state.writeCalls += 1;
			},
		},
	};
}

function createSeedServiceHarness(
	options: {
		readonly dictEntries?: readonly DictionaryEntry[];
		readonly lemmaEntries?: readonly LemmaEntry[];
		readonly loadAssets?: (
			manifest: DictionarySeedManifest,
		) => Promise<DictionarySeedAssets>;
		readonly loadManifest?: () => Promise<DictionarySeedManifest>;
		readonly seedState?: DictionarySeedState | null;
	} = {},
): {
	readonly createService: () => DictionarySeedService;
	readonly loadAssetsCalls: { current: number };
	readonly loadManifestCalls: { current: number };
	readonly repository: InMemoryRepositoryState;
	readonly seedState: InMemorySeedStateStorageState;
	readonly service: DictionarySeedService;
} {
	const loadManifestCalls = { current: 0 };
	const loadAssetsCalls = { current: 0 };
	const repository = createInMemoryRepository({
		...(options.dictEntries === undefined
			? {}
			: { dictEntries: options.dictEntries }),
		...(options.lemmaEntries === undefined
			? {}
			: { lemmaEntries: options.lemmaEntries }),
	});
	const storage = createInMemorySeedStateStorage(options.seedState ?? null);

	const createService = (): DictionarySeedService =>
		createDictionarySeedService({
			assetLoader: {
				loadAssets: async (
					manifest: DictionarySeedManifest,
				): Promise<DictionarySeedAssets> => {
					loadAssetsCalls.current += 1;
					return await (options.loadAssets?.(manifest) ??
						Promise.resolve(TEST_ASSETS));
				},
				loadManifest: async (): Promise<DictionarySeedManifest> => {
					loadManifestCalls.current += 1;
					return await (options.loadManifest?.() ??
						Promise.resolve(TEST_MANIFEST));
				},
			},
			repository: repository.repository,
			storage: storage.storage,
		});

	return {
		createService: createService,
		loadAssetsCalls: loadAssetsCalls,
		loadManifestCalls: loadManifestCalls,
		repository: repository.state,
		seedState: storage.state,
		service: createService(),
	};
}

describe("createDictionarySeedService", () => {
	it("seeds the tables and records the state after loading manifest and assets", async () => {
		const harness = createSeedServiceHarness();

		await harness.service.ensureSeeded();

		expect(harness.loadManifestCalls.current).toBe(1);
		expect(harness.loadAssetsCalls.current).toBe(1);
		expect(harness.repository.clearAllCalls).toBe(1);
		expect(harness.repository.dictEntries).toEqual(TEST_DICT_ENTRIES);
		expect(harness.repository.lemmaEntries).toEqual(TEST_LEMMA_ENTRIES);
		expect(harness.seedState.seedState).toEqual(createMatchingSeedState());
	});

	it("skips when the fingerprint and format version still match", async () => {
		const harness = createSeedServiceHarness({
			dictEntries: TEST_DICT_ENTRIES,
			lemmaEntries: TEST_LEMMA_ENTRIES,
			loadAssets: async (): Promise<DictionarySeedAssets> => {
				throw new Error("loadAssets should not run when seeding is skipped");
			},
			seedState: createMatchingSeedState(),
		});

		await harness.service.ensureSeeded();

		expect(harness.loadManifestCalls.current).toBe(1);
		expect(harness.loadAssetsCalls.current).toBe(0);
		expect(harness.repository.clearAllCalls).toBe(0);
		expect(harness.seedState.writeCalls).toBe(0);
	});

	it("runs the seed once for concurrent and later callers", async () => {
		const harness = createSeedServiceHarness();

		await Promise.all([
			harness.service.ensureSeeded(),
			harness.service.ensureSeeded(),
		]);
		await harness.service.ensureSeeded();

		expect(harness.loadManifestCalls.current).toBe(1);
		expect(harness.loadAssetsCalls.current).toBe(1);
	});

	it("reseeds when the tables are not populated even though the stored seed state matches", async () => {
		const harness = createSeedServiceHarness({
			dictEntries: TEST_DICT_ENTRIES,
			seedState: createMatchingSeedState(),
		});

		await harness.service.ensureSeeded();

		expect(harness.loadAssetsCalls.current).toBe(1);
		expect(harness.repository.clearAllCalls).toBe(1);
		expect(harness.repository.lemmaEntries).toEqual(TEST_LEMMA_ENTRIES);
	});

	it("reseeds when a rebuilt artifact changed the manifest fingerprint", async () => {
		const rebuiltManifest: DictionarySeedManifest = {
			...TEST_MANIFEST,
			assetFingerprint: "rebuilt-asset-fingerprint",
		};
		const harness = createSeedServiceHarness({
			dictEntries: TEST_DICT_ENTRIES,
			lemmaEntries: TEST_LEMMA_ENTRIES,
			loadManifest: async (): Promise<DictionarySeedManifest> =>
				rebuiltManifest,
			seedState: createMatchingSeedState(),
		});

		await harness.service.ensureSeeded();

		expect(harness.loadAssetsCalls.current).toBe(1);
		expect(harness.seedState.seedState).toEqual({
			assetFingerprint: rebuiltManifest.assetFingerprint,
			seedFormatVersion: SEED_FORMAT_VERSION,
		});
	});

	it("reseeds when the stored seed format version is stale", async () => {
		const harness = createSeedServiceHarness({
			dictEntries: TEST_DICT_ENTRIES,
			lemmaEntries: TEST_LEMMA_ENTRIES,
			seedState: {
				...createMatchingSeedState(),
				seedFormatVersion: SEED_FORMAT_VERSION - 1,
			},
		});

		await harness.service.ensureSeeded();

		expect(harness.loadAssetsCalls.current).toBe(1);
		expect(harness.seedState.seedState).toEqual(createMatchingSeedState());
	});

	it("keeps rejecting with the first failure without loading assets again", async () => {
		const seedError = new Error("asset load failed");
		const harness = createSeedServiceHarness({
			loadAssets: async (): Promise<DictionarySeedAssets> => {
				throw seedError;
			},
		});

		await expect(harness.service.ensureSeeded()).rejects.toBe(seedError);
		await expect(harness.service.ensureSeeded()).rejects.toBe(seedError);

		expect(harness.loadManifestCalls.current).toBe(1);
		expect(harness.loadAssetsCalls.current).toBe(1);
		expect(harness.seedState.seedState).toBeNull();
	});

	it("retries in a fresh service instance after a failure", async () => {
		let failNextLoad = true;
		const harness = createSeedServiceHarness({
			loadAssets: async (): Promise<DictionarySeedAssets> => {
				if (failNextLoad) {
					failNextLoad = false;
					throw new Error("asset load failed");
				}
				return TEST_ASSETS;
			},
		});
		await expect(harness.service.ensureSeeded()).rejects.toThrow(
			"asset load failed",
		);

		await harness.createService().ensureSeeded();

		expect(harness.loadAssetsCalls.current).toBe(2);
		expect(harness.seedState.seedState).toEqual(createMatchingSeedState());
	});
});
