import { describe, expect, it } from "vitest";

import type {
	DictionaryEntry,
	LemmaEntry,
} from "../../shared/dictionary/types";
import {
	createTestDictionaryEntry,
	type DictionaryRows,
} from "../../test-helpers/dictionaryFixtures";
import { TEST_DICTIONARY_METADATA } from "../../test-helpers/dictionaryMetadata";

import {
	type DictionaryAssetLoader,
	type DictionarySeedManifest,
	SEED_FORMAT_VERSION,
} from "./assets";
import {
	createDictionarySeedService,
	type DictionarySeedService,
	type DictionarySeedState,
} from "./seed";

const FIRST_SHARD: readonly DictionaryEntry[] = [
	createTestDictionaryEntry("agenda"),
];
const LAST_SHARD: readonly DictionaryEntry[] = [
	createTestDictionaryEntry("run"),
];
const TEST_SHARDS: readonly (readonly DictionaryEntry[])[] = [
	FIRST_SHARD,
	[createTestDictionaryEntry("go")],
	LAST_SHARD,
];

const TEST_DICT_ENTRIES: readonly DictionaryEntry[] = TEST_SHARDS.flat();

const TEST_LEMMA_ENTRIES: readonly LemmaEntry[] = [
	{
		lemma: "agenda",
		surface: "agendas",
	},
];

const TEST_MANIFEST: DictionarySeedManifest = {
	assetFingerprint: "asset-fingerprint",
	metadata: TEST_DICTIONARY_METADATA,
};

type ShardSource = () => AsyncIterable<readonly DictionaryEntry[]>;

async function* yieldTestShards(): AsyncGenerator<readonly DictionaryEntry[]> {
	yield* TEST_SHARDS;
}

function failAtShardOnce(failingIndex: number, error: Error): ShardSource {
	let failed = false;

	return async function* (): AsyncGenerator<readonly DictionaryEntry[]> {
		for (const [shardIndex, shard] of TEST_SHARDS.entries()) {
			if (shardIndex === failingIndex && !failed) {
				failed = true;
				throw error;
			}
			yield shard;
		}
	};
}

function createMatchingSeedState(): DictionarySeedState {
	return {
		assetFingerprint: TEST_MANIFEST.assetFingerprint,
		seedFormatVersion: SEED_FORMAT_VERSION,
	};
}

interface SeedHarnessOptions extends Partial<DictionaryRows> {
	readonly loadDictShards?: ShardSource;
	readonly loadManifest?: DictionaryAssetLoader["loadManifest"];
	readonly seedState?: DictionarySeedState | null;
}

interface SeedHarnessState {
	dictEntries: readonly DictionaryEntry[];
	readonly events: string[];
	lemmaEntries: readonly LemmaEntry[];
	seedState: DictionarySeedState | null;
}

function countEvents(state: SeedHarnessState, event: string): number {
	return state.events.filter((logged) => logged === event).length;
}

function listShardLoads(state: SeedHarnessState): readonly string[] {
	return state.events.filter((logged) => logged.startsWith("load shard"));
}

function createSeedServiceHarness(options: SeedHarnessOptions = {}): {
	readonly createService: () => DictionarySeedService;
	readonly service: DictionarySeedService;
	readonly state: SeedHarnessState;
} {
	const state: SeedHarnessState = {
		dictEntries: options.dictEntries ?? [],
		events: [],
		lemmaEntries: options.lemmaEntries ?? [],
		seedState: options.seedState ?? null,
	};
	const loadDictShards = options.loadDictShards ?? yieldTestShards;
	const loadManifest =
		options.loadManifest ??
		(async (): Promise<DictionarySeedManifest> => TEST_MANIFEST);

	const createService = (): DictionarySeedService =>
		createDictionarySeedService({
			assetLoader: {
				loadDictShards: async function* (): AsyncGenerator<
					readonly DictionaryEntry[]
				> {
					let shardIndex = 0;
					for await (const shard of loadDictShards()) {
						state.events.push(`load shard ${shardIndex}`);
						shardIndex += 1;
						yield shard;
					}
				},
				loadLemmaEntries: async (): Promise<readonly LemmaEntry[]> => {
					state.events.push("load lemma");
					return TEST_LEMMA_ENTRIES;
				},
				loadManifest: async (): Promise<DictionarySeedManifest> => {
					state.events.push("load manifest");
					return await loadManifest();
				},
			},
			repository: {
				clearAll: async (): Promise<void> => {
					state.events.push("clear tables");
					state.dictEntries = [];
					state.lemmaEntries = [];
				},
				isPopulated: async (): Promise<boolean> =>
					state.dictEntries.length > 0 && state.lemmaEntries.length > 0,
				putDictEntries: async (
					entries: readonly DictionaryEntry[],
				): Promise<void> => {
					state.events.push(
						`put dict ${entries.map((entry) => entry.word).join(",")}`,
					);
					state.dictEntries = [...state.dictEntries, ...entries];
				},
				putLemmaEntries: async (
					entries: readonly LemmaEntry[],
				): Promise<void> => {
					state.events.push("put lemma");
					state.lemmaEntries = [...state.lemmaEntries, ...entries];
				},
			},
			storage: {
				clearState: async (): Promise<void> => {
					state.events.push("clear state");
					state.seedState = null;
				},
				readState: async (): Promise<DictionarySeedState | null> =>
					state.seedState,
				writeState: async (seedState: DictionarySeedState): Promise<void> => {
					state.events.push("write state");
					state.seedState = seedState;
				},
			},
		});

	return {
		createService: createService,
		service: createService(),
		state: state,
	};
}

describe("createDictionarySeedService seeding", () => {
	it("seeds every shard and the lemma rows, then records the state", async () => {
		const { service, state } = createSeedServiceHarness();

		await service.ensureSeeded();

		expect(state.dictEntries).toEqual(TEST_DICT_ENTRIES);
		expect(state.lemmaEntries).toEqual(TEST_LEMMA_ENTRIES);
		expect(state.seedState).toEqual(createMatchingSeedState());
	});

	it("writes each shard before loading the next and records the state last", async () => {
		const { service, state } = createSeedServiceHarness();

		await service.ensureSeeded();

		expect(state.events).toEqual([
			"load manifest",
			"clear state",
			"clear tables",
			"load shard 0",
			"put dict agenda",
			"load shard 1",
			"put dict go",
			"load shard 2",
			"put dict run",
			"load lemma",
			"put lemma",
			"write state",
		]);
	});

	it("resolves no caller before the last row is written", async () => {
		const reachedLastShard = Promise.withResolvers<void>();
		const lastShard = Promise.withResolvers<readonly DictionaryEntry[]>();
		const { service, state } = createSeedServiceHarness({
			loadDictShards: async function* (): AsyncGenerator<
				readonly DictionaryEntry[]
			> {
				yield* TEST_SHARDS.slice(0, -1);
				reachedLastShard.resolve();
				yield await lastShard.promise;
			},
		});
		const settledCallers: string[] = [];
		const firstCaller = service.ensureSeeded().then(() => {
			settledCallers.push("first");
		});
		const secondCaller = service.ensureSeeded().then(() => {
			settledCallers.push("second");
		});

		await reachedLastShard.promise;
		expect(settledCallers).toEqual([]);
		expect(state.seedState).toBeNull();

		lastShard.resolve(LAST_SHARD);
		await Promise.all([firstCaller, secondCaller]);
		expect(settledCallers).toEqual(["first", "second"]);
		expect(state.seedState).toEqual(createMatchingSeedState());
	});

	it("runs the seed once for concurrent and later callers", async () => {
		const { service, state } = createSeedServiceHarness();

		await Promise.all([service.ensureSeeded(), service.ensureSeeded()]);
		await service.ensureSeeded();

		expect(countEvents(state, "load manifest")).toBe(1);
		expect(listShardLoads(state)).toHaveLength(TEST_SHARDS.length);
	});
});

describe("createDictionarySeedService skip and reseed", () => {
	it("skips when the fingerprint and format version still match", async () => {
		const { service, state } = createSeedServiceHarness({
			dictEntries: TEST_DICT_ENTRIES,
			lemmaEntries: TEST_LEMMA_ENTRIES,
			seedState: createMatchingSeedState(),
		});

		await service.ensureSeeded();

		expect(state.events).toEqual(["load manifest"]);
	});

	it("reseeds when the tables are not populated even though the stored seed state matches", async () => {
		const { service, state } = createSeedServiceHarness({
			dictEntries: TEST_DICT_ENTRIES,
			seedState: createMatchingSeedState(),
		});

		await service.ensureSeeded();

		expect(countEvents(state, "clear tables")).toBe(1);
		expect(state.dictEntries).toEqual(TEST_DICT_ENTRIES);
		expect(state.lemmaEntries).toEqual(TEST_LEMMA_ENTRIES);
	});

	it("reseeds when a rebuilt artifact changed the manifest fingerprint", async () => {
		const rebuiltManifest: DictionarySeedManifest = {
			...TEST_MANIFEST,
			assetFingerprint: "rebuilt-asset-fingerprint",
		};
		const { service, state } = createSeedServiceHarness({
			dictEntries: TEST_DICT_ENTRIES,
			lemmaEntries: TEST_LEMMA_ENTRIES,
			loadManifest: async (): Promise<DictionarySeedManifest> =>
				rebuiltManifest,
			seedState: createMatchingSeedState(),
		});

		await service.ensureSeeded();

		expect(listShardLoads(state)).toHaveLength(TEST_SHARDS.length);
		expect(state.seedState).toEqual({
			assetFingerprint: rebuiltManifest.assetFingerprint,
			seedFormatVersion: SEED_FORMAT_VERSION,
		});
	});

	it("reseeds when the stored seed format version is stale", async () => {
		const { service, state } = createSeedServiceHarness({
			dictEntries: TEST_DICT_ENTRIES,
			lemmaEntries: TEST_LEMMA_ENTRIES,
			seedState: {
				...createMatchingSeedState(),
				seedFormatVersion: SEED_FORMAT_VERSION - 1,
			},
		});

		await service.ensureSeeded();

		expect(listShardLoads(state)).toHaveLength(TEST_SHARDS.length);
		expect(state.seedState).toEqual(createMatchingSeedState());
	});
});

describe("createDictionarySeedService failures", () => {
	it("keeps rejecting with the first failure without loading again", async () => {
		const shardError = new Error("shard 1 failed");
		const { service, state } = createSeedServiceHarness({
			loadDictShards: failAtShardOnce(1, shardError),
		});

		await expect(service.ensureSeeded()).rejects.toBe(shardError);
		const eventsAfterFailure = [...state.events];
		await expect(service.ensureSeeded()).rejects.toBe(shardError);

		expect(state.events).toEqual(eventsAfterFailure);
		expect(countEvents(state, "load manifest")).toBe(1);
		expect(state.seedState).toBeNull();
	});

	it("reseeds from scratch in a fresh service after a middle shard failed", async () => {
		const { createService, service, state } = createSeedServiceHarness({
			loadDictShards: failAtShardOnce(1, new Error("shard 1 failed")),
		});
		await expect(service.ensureSeeded()).rejects.toThrow("shard 1 failed");
		expect(state.dictEntries).toEqual(FIRST_SHARD);
		expect(countEvents(state, "write state")).toBe(0);

		await createService().ensureSeeded();

		expect(countEvents(state, "clear tables")).toBe(2);
		expect(state.dictEntries).toEqual(TEST_DICT_ENTRIES);
		expect(state.lemmaEntries).toEqual(TEST_LEMMA_ENTRIES);
		expect(state.seedState).toEqual(createMatchingSeedState());
	});
});
