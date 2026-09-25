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
import type {
	DictionaryEntryRepository,
	LemmaRepository,
} from "@/background/dictionary/repositories";
import {
	createDictionaryResolveService,
	type DictionaryResolveService,
} from "@/background/dictionary/resolveService";
import {
	createDictionarySeedService,
	type DictionarySeedService,
} from "@/background/dictionary/seed";
import { createBrowserDictionarySeedStateStorage } from "@/background/dictionary/storage";
import type { DictionaryEntry, LemmaEntry } from "@/shared/dictionary/types";

interface DictionaryBrowserAdapter {
	readonly dictionaryResolveService: DictionaryResolveService;
	readonly dictionarySeedService: DictionarySeedService;
	readonly lemmaExpansionService: LemmaExpansionService;
}

type GetSeededDictionary = () => Promise<StaticDictionaryDatabase>;

// anyOf walks one value cursor across the whole key range; reading only the
// keys of each lemma, pipelined in one transaction, is faster in Firefox. A
// row is just its surface key plus the lemma asked for. `then` rather than
// `await` keeps this a plain Dexie promise, which skips Dexie's zone tracking
// for native awaits.
function listLemmaRows(
	table: StaticDictionaryDatabase["lemma"],
	lemma: string,
): Promise<readonly LemmaEntry[]> {
	return table
		.where("lemma")
		.equals(lemma)
		.primaryKeys()
		.then((surfaces) =>
			surfaces.map((surface) => ({ lemma: lemma, surface: surface })),
		);
}

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
			const rowsByLemma = await dictionary.transaction(
				"r",
				dictionary.lemma,
				() =>
					Promise.all(
						[...new Set(lemmas)].map((lemma) =>
							listLemmaRows(dictionary.lemma, lemma),
						),
					),
			);
			return rowsByLemma.flat();
		},
	};
}

// count() walks the whole store; one primary key answers "is it empty".
async function hasRows(table: Table<unknown, string>): Promise<boolean> {
	return (await table.limit(1).primaryKeys()).length > 0;
}

function createDictionarySeedBrowserAdapter(): DictionarySeedService {
	return createDictionarySeedService({
		assetLoader: createDictionaryAssetLoader({
			fetch: fetch.bind(globalThis),
			getUrl: (assetPath: PublicPath): string =>
				browser.runtime.getURL(assetPath),
		}),
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
		dictionaryResolveService: createDictionaryResolveService({
			dictRepository: createSeededDictEntryRepository(getSeededDictionary),
			lemmaRepository: lemmaRepository,
		}),
		dictionarySeedService: dictionarySeedService,
		lemmaExpansionService: createLemmaExpansionService({
			lemmaRepository: lemmaRepository,
		}),
	};
}
