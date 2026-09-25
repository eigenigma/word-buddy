import type { DictionaryEntry, LemmaEntry } from "@/shared/dictionary/types";

import {
	type DictionaryAssetLoader,
	type DictionarySeedManifest,
	SEED_FORMAT_VERSION,
} from "./assets";

const STATIC_DICTIONARY_CHUNK_SIZE = 1000;

export interface DictionarySeedState {
	readonly assetFingerprint: string;
	readonly seedFormatVersion: number;
}

export interface DictionarySeedRepository {
	readonly clearAll: () => Promise<void>;
	readonly isPopulated: () => Promise<boolean>;
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
	readonly assetLoader: DictionaryAssetLoader;
	readonly repository: DictionarySeedRepository;
	readonly storage: DictionarySeedStateStorage;
}

export interface DictionarySeedService {
	readonly ensureSeeded: () => Promise<void>;
}

function toSeedState(manifest: DictionarySeedManifest): DictionarySeedState {
	return {
		assetFingerprint: manifest.assetFingerprint,
		seedFormatVersion: SEED_FORMAT_VERSION,
	};
}

function isSameSeedState(
	left: DictionarySeedState,
	right: DictionarySeedState,
): boolean {
	return (
		left.assetFingerprint === right.assetFingerprint &&
		left.seedFormatVersion === right.seedFormatVersion
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
): Promise<void> {
	const [manifest, tablesPopulated, storedSeedState] = await Promise.all([
		dependencies.assetLoader.loadManifest(),
		dependencies.repository.isPopulated(),
		dependencies.storage.readState(),
	]);
	const currentSeedState = toSeedState(manifest);
	if (
		tablesPopulated &&
		storedSeedState !== null &&
		isSameSeedState(storedSeedState, currentSeedState)
	) {
		return;
	}

	await dependencies.storage.clearState();
	await dependencies.repository.clearAll();
	// One parsed shard in memory at a time, fetched and parsed outside the
	// write transactions.
	for await (const shard of dependencies.assetLoader.loadDictShards(manifest)) {
		await seedEntriesInChunks(shard, dependencies.repository.putDictEntries);
	}
	await seedEntriesInChunks(
		await dependencies.assetLoader.loadLemmaEntries(),
		dependencies.repository.putLemmaEntries,
	);
	await dependencies.storage.writeState(currentSeedState);
}

// One attempt per service lifetime: a failed seed keeps rejecting with the
// same error, because retrying would reread every asset for each lookup and
// most failures would repeat anyway. The next background start retries.
export function createDictionarySeedService(
	dependencies: DictionarySeedServiceDependencies,
): DictionarySeedService {
	let seedPromise: Promise<void> | null = null;

	return {
		ensureSeeded: (): Promise<void> => {
			seedPromise ??= performSeed(dependencies);
			return seedPromise;
		},
	};
}
