import {
	loadDictionarySeedAssets,
	loadDictionarySeedManifest,
} from "@/background/dictionary/assets";
import {
	STATIC_DICTIONARY_DB_SCHEMA_VERSION,
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

function createDictionaryQueryBrowserAdapter(): DictionaryQueryService {
	return createDictionaryQueryService({
		dictRepository: {
			getByWord: (word: string) => staticDictionaryDb.dict.get(word),
		},
		lemmaRepository: {
			getBySurface: async (surface: string) =>
				(await staticDictionaryDb.lemma.get(surface))?.lemma,
		},
	});
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
	dictionarySeedService: DictionarySeedService,
): LemmaExpansionService {
	return createLemmaExpansionService({
		repository: {
			listAll: async () => {
				await dictionarySeedService.ensureSeeded();
				return await staticDictionaryDb.lemma.toArray();
			},
		},
	});
}

export function createDictionaryBrowserAdapter(): DictionaryBrowserAdapter {
	const dictionarySeedService = createDictionarySeedBrowserAdapter();

	return {
		dictionaryQueryService: createDictionaryQueryBrowserAdapter(),
		dictionarySeedService: dictionarySeedService,
		lemmaExpansionService: createLemmaExpansionBrowserAdapter(
			dictionarySeedService,
		),
	};
}
