import { z } from "zod";

import type { DictionaryEntry, LemmaEntry } from "@/shared/dictionary/types";
import type { StaticDictionarySeedStatusResponse } from "@/shared/runtime/messages/dictionaryMessages";
import { toErrorMessage } from "@/shared/utils/errors";

import type { DictionarySeedAssets, DictionarySeedManifest } from "./assets";

const STATIC_DICTIONARY_SEED_KEY = "staticDictionarySeedState";
const STATIC_DICTIONARY_CHUNK_SIZE = 1000;

type DictionarySeedLastAction = "seeded" | "skipped" | null;

export interface DictionarySeedState {
	readonly assetFingerprint: string;
	readonly assetSchemaVersion: number;
	readonly dbSchemaVersion: number;
	readonly dictEntryCount: number;
	readonly lemmaEntryCount: number;
}

export interface DictionarySeedRepository {
	readonly clearAll: () => Promise<void>;
	readonly countDictEntries: () => Promise<number>;
	readonly countLemmaEntries: () => Promise<number>;
	readonly putDictEntries: (
		entries: readonly DictionaryEntry[],
	) => Promise<void>;
	readonly putLemmaEntries: (entries: readonly LemmaEntry[]) => Promise<void>;
}

export interface DictionarySeedStateStorage {
	readonly clearState: () => Promise<void>;
	readonly readState: () => Promise<DictionarySeedState | null>;
	readonly writeState: (seedState: DictionarySeedState) => Promise<void>;
}

export interface DictionarySeedServiceDependencies {
	readonly dbSchemaVersion: number;
	readonly loadAssets: (
		manifest: DictionarySeedManifest,
	) => Promise<DictionarySeedAssets>;
	readonly loadManifest: () => Promise<DictionarySeedManifest>;
	readonly repository: DictionarySeedRepository;
	readonly storage: DictionarySeedStateStorage;
}

export interface DictionarySeedService {
	readonly ensureSeeded: () => Promise<void>;
	readonly getStatus: () => Promise<StaticDictionarySeedStatusResponse>;
}

interface DictionarySeedRuntimeState {
	lastAction: DictionarySeedLastAction;
	lastError: string | null;
	seedPromise: Promise<void> | null;
}

const DictionarySeedStateSchema: z.ZodType<DictionarySeedState> = z
	.object({
		assetFingerprint: z.string(),
		assetSchemaVersion: z.number(),
		dbSchemaVersion: z.number(),
		dictEntryCount: z.number(),
		lemmaEntryCount: z.number(),
	})
	.readonly();

function createDictionarySeedState(
	assets: DictionarySeedAssets,
	dbSchemaVersion: number,
): DictionarySeedState {
	return {
		assetFingerprint: assets.assetFingerprint,
		assetSchemaVersion: assets.metadata.schemaVersion,
		dbSchemaVersion: dbSchemaVersion,
		dictEntryCount: assets.dictEntries.length,
		lemmaEntryCount: assets.lemmaEntries.length,
	};
}

function matchesDictionarySeedState(
	seedState: DictionarySeedState,
	manifest: DictionarySeedManifest,
	dbSchemaVersion: number,
): boolean {
	return (
		seedState.assetFingerprint === manifest.assetFingerprint &&
		seedState.assetSchemaVersion === manifest.metadata.schemaVersion &&
		seedState.dbSchemaVersion === dbSchemaVersion
	);
}

async function readSeedSnapshot(
	dependencies: DictionarySeedServiceDependencies,
): Promise<{
	readonly dictCount: number;
	readonly lemmaCount: number;
	readonly seedState: DictionarySeedState | null;
}> {
	const [dictCount, lemmaCount, seedState] = await Promise.all([
		dependencies.repository.countDictEntries(),
		dependencies.repository.countLemmaEntries(),
		dependencies.storage.readState(),
	]);

	return {
		dictCount: dictCount,
		lemmaCount: lemmaCount,
		seedState: seedState,
	};
}

async function shouldSeedStaticDictionary(
	dependencies: DictionarySeedServiceDependencies,
	manifest: DictionarySeedManifest,
): Promise<boolean> {
	const snapshot = await readSeedSnapshot(dependencies);
	const tablesPopulated = snapshot.dictCount > 0 && snapshot.lemmaCount > 0;
	if (!tablesPopulated || snapshot.seedState === null) {
		return true;
	}

	return !matchesDictionarySeedState(
		snapshot.seedState,
		manifest,
		dependencies.dbSchemaVersion,
	);
}

async function seedEntriesInChunks<TEntry>(
	entries: readonly TEntry[],
	putChunk: (chunk: readonly TEntry[]) => Promise<void>,
): Promise<void> {
	for (
		let offset = 0;
		offset < entries.length;
		offset += STATIC_DICTIONARY_CHUNK_SIZE
	) {
		const chunk = entries.slice(offset, offset + STATIC_DICTIONARY_CHUNK_SIZE);
		await putChunk(chunk);
	}
}

async function performSeed(
	dependencies: DictionarySeedServiceDependencies,
	runtimeState: DictionarySeedRuntimeState,
): Promise<void> {
	const manifest = await dependencies.loadManifest();
	const needsSeed = await shouldSeedStaticDictionary(dependencies, manifest);
	if (!needsSeed) {
		runtimeState.lastAction = "skipped";
		runtimeState.lastError = null;
		return;
	}

	const assets = await dependencies.loadAssets(manifest);
	await dependencies.storage.clearState();
	await dependencies.repository.clearAll();
	await Promise.all([
		seedEntriesInChunks(
			assets.dictEntries,
			dependencies.repository.putDictEntries,
		),
		seedEntriesInChunks(
			assets.lemmaEntries,
			dependencies.repository.putLemmaEntries,
		),
	]);
	await dependencies.storage.writeState(
		createDictionarySeedState(assets, dependencies.dbSchemaVersion),
	);
	runtimeState.lastAction = "seeded";
	runtimeState.lastError = null;
}

async function collectStatus(
	dependencies: DictionarySeedServiceDependencies,
	runtimeState: DictionarySeedRuntimeState,
): Promise<StaticDictionarySeedStatusResponse> {
	const snapshot = await readSeedSnapshot(dependencies);
	return {
		dictCount: snapshot.dictCount,
		hasSeedState: snapshot.seedState !== null,
		lastAction: runtimeState.lastAction,
		lastError: runtimeState.lastError,
		lemmaCount: snapshot.lemmaCount,
	};
}

export function createBrowserDictionarySeedStateStorage(): DictionarySeedStateStorage {
	return {
		clearState: async (): Promise<void> => {
			await browser.storage.local.remove(STATIC_DICTIONARY_SEED_KEY);
		},
		readState: async (): Promise<DictionarySeedState | null> => {
			const storageValue = await browser.storage.local.get(
				STATIC_DICTIONARY_SEED_KEY,
			);
			const seedState = storageValue[STATIC_DICTIONARY_SEED_KEY];
			const parsedSeedState = DictionarySeedStateSchema.safeParse(seedState);

			return parsedSeedState.success ? parsedSeedState.data : null;
		},
		writeState: async (seedState: DictionarySeedState): Promise<void> => {
			await browser.storage.local.set({
				[STATIC_DICTIONARY_SEED_KEY]: seedState,
			});
		},
	};
}

export function createDictionarySeedService(
	dependencies: DictionarySeedServiceDependencies,
): DictionarySeedService {
	const runtimeState: DictionarySeedRuntimeState = {
		lastAction: null,
		lastError: null,
		seedPromise: null,
	};

	const ensureSeeded = (): Promise<void> => {
		runtimeState.seedPromise ??= performSeed(dependencies, runtimeState).catch(
			(error: unknown): never => {
				runtimeState.lastAction = null;
				runtimeState.lastError = toErrorMessage(error);
				runtimeState.seedPromise = null;
				throw error;
			},
		);

		return runtimeState.seedPromise;
	};

	return {
		ensureSeeded: ensureSeeded,
		getStatus: async (): Promise<StaticDictionarySeedStatusResponse> => {
			await ensureSeeded().catch((): void => {
				// Seed failure is already captured in runtimeState.lastError by
				// ensureSeeded's catch; surface it via collectStatus below.
			});
			return await collectStatus(dependencies, runtimeState);
		},
	};
}
