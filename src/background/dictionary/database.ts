import Dexie, { type EntityTable } from "dexie";

import type { DictionaryEntry, LemmaEntry } from "@/shared/dictionary/types";

export const STATIC_DICTIONARY_DB_NAME = "word-buddy";
export const STATIC_DICTIONARY_DB_SCHEMA_VERSION = 1;

export class StaticDictionaryDatabase extends Dexie {
	dict!: EntityTable<DictionaryEntry, "word">;
	lemma!: EntityTable<LemmaEntry, "surface">;

	public constructor() {
		super(STATIC_DICTIONARY_DB_NAME);
		this.version(STATIC_DICTIONARY_DB_SCHEMA_VERSION).stores({
			dict: "word",
			lemma: "surface",
		});
	}
}

export const staticDictionaryDb = new StaticDictionaryDatabase();
