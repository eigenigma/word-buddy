import { describe, expect, it } from "vitest";

import type {
	DictionaryBuildMetadata,
	DictionaryEntry,
	LemmaEntry,
} from "../../shared/dictionary/types";

import type { DictionarySeedAssets, DictionarySeedManifest } from "./assets";
import {
	createDictionarySeedService,
	type DictionarySeedRepository,
	type DictionarySeedState,
	type DictionarySeedStateStorage,
} from "./seed";

const DB_SCHEMA_VERSION = 7;

const TEST_METADATA: DictionaryBuildMetadata = {
	dictShardCount: 1,
	filterPolicy: {
		lexicalWordPattern: "^[a-z]+$",
		requireMeaning: true,
		requireQualitySignal: ["bnc"],
		retainLowercaseHeadwordsOnly: true,
	},
	outputs: {
		dictEntries: 1,
		duplicateDictEntriesDiscarded: 0,
		lemmaConflictsSkipped: 0,
		lemmaExchangeMappings: 0,
		lemmaEntries: 1,
		lemmaPrimaryMappings: 1,
		lemmaSelfMappings: 1,
		lemmaSkippedMissingDictionary: 0,
		rejectedRows: {
			duplicateWord: 0,
			emptyMeaning: 0,
			nonLexicalWord: 0,
			weakSignal: 0,
		},
	},
	schemaVersion: 1,
	sources: {
		ecdict: {
			rowCount: 1,
			sha256: "dict-sha",
		},
		lemma: {
			rowCount: 1,
			sha256: "lemma-sha",
		},
	},
};

const TEST_MANIFEST: DictionarySeedManifest = {
	assetFingerprint: "asset-fingerprint",
	metadata: TEST_METADATA,
};

const TEST_DICT_ENTRIES: readonly DictionaryEntry[] = [
	{
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
	},
];

const TEST_LEMMA_ENTRIES: readonly LemmaEntry[] = [
	{
		lemma: "agenda",
		surface: "agendas",
	},
];

const TEST_ASSETS: DictionarySeedAssets = {
	assetFingerprint: TEST_MANIFEST.assetFingerprint,
	dictEntries: TEST_DICT_ENTRIES,
	lemmaEntries: TEST_LEMMA_ENTRIES,
	metadata: TEST_MANIFEST.metadata,
};

function createMatchingSeedState(): DictionarySeedState {
	return {
		assetFingerprint: TEST_MANIFEST.assetFingerprint,
		assetSchemaVersion: TEST_MANIFEST.metadata.schemaVersion,
		dbSchemaVersion: DB_SCHEMA_VERSION,
		dictEntryCount: TEST_DICT_ENTRIES.length,
		lemmaEntryCount: TEST_LEMMA_ENTRIES.length,
	};
}

function createInMemoryRepository(
	initialState: {
		readonly dictEntries?: readonly DictionaryEntry[];
		readonly lemmaEntries?: readonly LemmaEntry[];
	} = {},
): {
	readonly repository: DictionarySeedRepository;
	readonly state: {
		clearAllCalls: number;
		dictEntries: readonly DictionaryEntry[];
		dictWriteCalls: number;
		lemmaEntries: readonly LemmaEntry[];
		lemmaWriteCalls: number;
	};
} {
	const state = {
		clearAllCalls: 0,
		dictEntries: initialState.dictEntries ?? [],
		dictWriteCalls: 0,
		lemmaEntries: initialState.lemmaEntries ?? [],
		lemmaWriteCalls: 0,
	};

	return {
		repository: {
			clearAll: async (): Promise<void> => {
				state.clearAllCalls += 1;
				state.dictEntries = [];
				state.lemmaEntries = [];
			},
			countDictEntries: async (): Promise<number> => state.dictEntries.length,
			countLemmaEntries: async (): Promise<number> => state.lemmaEntries.length,
			putDictEntries: async (
				entries: readonly DictionaryEntry[],
			): Promise<void> => {
				state.dictWriteCalls += 1;
				state.dictEntries = [...state.dictEntries, ...entries];
			},
			putLemmaEntries: async (
				entries: readonly LemmaEntry[],
			): Promise<void> => {
				state.lemmaWriteCalls += 1;
				state.lemmaEntries = [...state.lemmaEntries, ...entries];
			},
		},
		state: state,
	};
}

function createInMemorySeedStateStorage(
	initialSeedState: DictionarySeedState | null = null,
): {
	readonly state: { seedState: DictionarySeedState | null; writeCalls: number };
	readonly storage: DictionarySeedStateStorage;
} {
	const state = {
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
	readonly loadAssetsCalls: { current: number };
	readonly loadManifestCalls: { current: number };
	readonly repository: {
		clearAllCalls: number;
		dictEntries: readonly DictionaryEntry[];
		dictWriteCalls: number;
		lemmaEntries: readonly LemmaEntry[];
		lemmaWriteCalls: number;
	};
	readonly seedState: {
		seedState: DictionarySeedState | null;
		writeCalls: number;
	};
	readonly service: ReturnType<typeof createDictionarySeedService>;
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

	const service = createDictionarySeedService({
		dbSchemaVersion: DB_SCHEMA_VERSION,
		loadAssets: async (
			manifest: DictionarySeedManifest,
		): Promise<DictionarySeedAssets> => {
			loadAssetsCalls.current += 1;
			return await (options.loadAssets?.(manifest) ??
				Promise.resolve(TEST_ASSETS));
		},
		loadManifest: async (): Promise<DictionarySeedManifest> => {
			loadManifestCalls.current += 1;
			return await (options.loadManifest?.() ?? Promise.resolve(TEST_MANIFEST));
		},
		repository: repository.repository,
		storage: storage.storage,
	});

	return {
		loadAssetsCalls: loadAssetsCalls,
		loadManifestCalls: loadManifestCalls,
		repository: repository.state,
		seedState: storage.state,
		service: service,
	};
}

describe("createDictionarySeedService", () => {
	it("records the seeded transition after loading manifest and assets", async () => {
		const harness = createSeedServiceHarness();

		await harness.service.ensureSeeded();

		expect(harness.loadManifestCalls.current).toBe(1);
		expect(harness.loadAssetsCalls.current).toBe(1);
		expect(harness.repository.clearAllCalls).toBe(1);
		expect(harness.repository.dictEntries).toEqual(TEST_DICT_ENTRIES);
		expect(harness.repository.lemmaEntries).toEqual(TEST_LEMMA_ENTRIES);
		expect(harness.seedState.seedState).toEqual(createMatchingSeedState());
		expect(await harness.service.getStatus()).toEqual({
			dictCount: 1,
			hasSeedState: true,
			lastAction: "seeded",
			lastError: null,
			lemmaCount: 1,
		});
	});

	it("records the skipped transition when the stored seed state still matches", async () => {
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
		expect(await harness.service.getStatus()).toEqual({
			dictCount: 1,
			hasSeedState: true,
			lastAction: "skipped",
			lastError: null,
			lemmaCount: 1,
		});
	});

	it("records the error transition and resets the in-flight promise after failure", async () => {
		const harness = createSeedServiceHarness({
			loadAssets: async (): Promise<DictionarySeedAssets> => {
				throw new Error("asset load failed");
			},
		});

		await expect(harness.service.ensureSeeded()).rejects.toThrow(
			"asset load failed",
		);
		await expect(harness.service.getStatus()).resolves.toEqual({
			dictCount: 0,
			hasSeedState: false,
			lastAction: null,
			lastError: "asset load failed",
			lemmaCount: 0,
		});
	});
});
