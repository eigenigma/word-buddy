import type { Table } from "dexie";

import {
	loadDictionarySeedAssets,
	loadDictionarySeedManifest,
} from "@/background/dictionary/assets";
import {
	STATIC_DICTIONARY_DB_SCHEMA_VERSION,
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

function createDictionaryQueryBrowserAdapter(
	getSeededDictionary: GetSeededDictionary,
): DictionaryQueryService {
	return createDictionaryQueryService({
		dictRepository: {
			getByWord: async (word: string) => {
				const dictionary = await getSeededDictionary();
				return await dictionary.dict.get(word);
			},
		},
		lemmaRepository: {
			getBySurface: async (surface: string) => {
				const dictionary = await getSeededDictionary();
				return (await dictionary.lemma.get(surface))?.lemma;
			},
		},
	});
}

// count() walks the whole store; one primary key answers "is it empty".
async function hasRows(table: Table<unknown, string>): Promise<boolean> {
	return (await table.limit(1).primaryKeys()).length > 0;
}

function createDictionarySeedBrowserAdapter(): DictionarySeedService {
	return createDictionarySeedService({
		dbSchemaVersion: STATIC_DICTIONARY_DB_SCHEMA_VERSION,
		loadAssets: loadDictionarySeedAssets,
		loadManifest: loadDictionarySeedManifest,
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
			countDictEntries: () => staticDictionaryDb.dict.count(),
			countLemmaEntries: () => staticDictionaryDb.lemma.count(),
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

function createLemmaExpansionBrowserAdapter(
	getSeededDictionary: GetSeededDictionary,
): LemmaExpansionService {
	return createLemmaExpansionService({
		repository: {
			listByLemmas: async (lemmas: readonly string[]) => {
				const dictionary = await getSeededDictionary();
				return await dictionary.lemma.where("lemma").anyOf(lemmas).toArray();
			},
		},
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

	return {
		dictionaryQueryService:
			createDictionaryQueryBrowserAdapter(getSeededDictionary),
		dictionarySeedService: dictionarySeedService,
		lemmaExpansionService:
			createLemmaExpansionBrowserAdapter(getSeededDictionary),
	};
}
