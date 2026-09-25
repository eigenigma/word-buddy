import type { Table } from "dexie";
import type { PublicPath } from "wxt/browser";

import { createDictionaryAssetLoader } from "@/background/dictionary/assets";
import {
	type StaticDictionaryDatabase,
	staticDictionaryDb,
} from "@/background/dictionary/database";
import {
	createLemmaExpansionService,
	type LemmaExpansionService,
} from "@/background/dictionary/lemmaExpansionService";
import {
	createDictionaryQueryService,
	type DictionaryQueryService,
} from "@/background/dictionary/queryService";
import type {
	DictionaryEntryRepository,
	LemmaRepository,
} from "@/background/dictionary/repositories";
import {
	createBrowserDictionarySeedStateStorage,
	createDictionarySeedService,
	type DictionarySeedService,
} from "@/background/dictionary/seed";
import type { DictionaryEntry, LemmaEntry } from "@/shared/dictionary/types";

interface DictionaryBrowserAdapter {
	readonly dictionaryQueryService: DictionaryQueryService;
	readonly dictionarySeedService: DictionarySeedService;
	readonly lemmaExpansionService: LemmaExpansionService;
}

type GetSeededDictionary = () => Promise<StaticDictionaryDatabase>;

function createSeededDictEntryRepository(
	getSeededDictionary: GetSeededDictionary,
): DictionaryEntryRepository {
	return {
		getByWord: async (word: string): Promise<DictionaryEntry | null> => {
			const dictionary = await getSeededDictionary();
			return (await dictionary.dict.get(word)) ?? null;
		},
	};
}

function createSeededLemmaRepository(
	getSeededDictionary: GetSeededDictionary,
): LemmaRepository {
	return {
		getLemmaBySurface: async (surface: string): Promise<string | null> => {
			const dictionary = await getSeededDictionary();
			return (await dictionary.lemma.get(surface))?.lemma ?? null;
		},
		listByLemmas: async (
			lemmas: readonly string[],
		): Promise<readonly LemmaEntry[]> => {
			const dictionary = await getSeededDictionary();
			return await dictionary.lemma.where("lemma").anyOf(lemmas).toArray();
		},
	};
}

// count() walks the whole store; one primary key answers "is it empty".
async function hasRows(table: Table<unknown, string>): Promise<boolean> {
	return (await table.limit(1).primaryKeys()).length > 0;
}

function createDictionarySeedBrowserAdapter(): DictionarySeedService {
	const assetLoader = createDictionaryAssetLoader({
		fetch: fetch.bind(globalThis),
		getUrl: (assetPath: PublicPath): string =>
			browser.runtime.getURL(assetPath),
	});

	return createDictionarySeedService({
		loadAssets: assetLoader.loadAssets,
		loadManifest: assetLoader.loadManifest,
		repository: {
			clearAll: async (): Promise<void> => {
				await staticDictionaryDb.transaction(
					"rw",
					staticDictionaryDb.dict,
					staticDictionaryDb.lemma,
					async (): Promise<void> => {
						await staticDictionaryDb.dict.clear();
						await staticDictionaryDb.lemma.clear();
					},
				);
			},
			isPopulated: async (): Promise<boolean> => {
				const [hasDictRows, hasLemmaRows] = await Promise.all([
					hasRows(staticDictionaryDb.dict),
					hasRows(staticDictionaryDb.lemma),
				]);
				return hasDictRows && hasLemmaRows;
			},
			putDictEntries: async (entries: readonly DictionaryEntry[]) => {
				await staticDictionaryDb.transaction(
					"rw",
					staticDictionaryDb.dict,
					() => staticDictionaryDb.dict.bulkPut(entries),
				);
			},
			putLemmaEntries: async (entries: readonly LemmaEntry[]) => {
				await staticDictionaryDb.transaction(
					"rw",
					staticDictionaryDb.lemma,
					() => staticDictionaryDb.lemma.bulkPut(entries),
				);
			},
		},
		storage: createBrowserDictionarySeedStateStorage(),
	});
}

export function createDictionaryBrowserAdapter(): DictionaryBrowserAdapter {
	const dictionarySeedService = createDictionarySeedBrowserAdapter();
	// The router serves messages while seeding clears and refills the tables,
	// so every read waits for it instead of seeing a partial dictionary.
	const getSeededDictionary: GetSeededDictionary = async () => {
		await dictionarySeedService.ensureSeeded();
		return staticDictionaryDb;
	};
	const lemmaRepository = createSeededLemmaRepository(getSeededDictionary);

	return {
		dictionaryQueryService: createDictionaryQueryService({
			dictRepository: createSeededDictEntryRepository(getSeededDictionary),
			lemmaRepository: lemmaRepository,
		}),
		dictionarySeedService: dictionarySeedService,
		lemmaExpansionService: createLemmaExpansionService({
			lemmaRepository: lemmaRepository,
		}),
	};
}
