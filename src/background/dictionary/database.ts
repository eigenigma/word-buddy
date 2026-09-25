import Dexie, { type EntityTable } from "dexie";

import type { DictionaryEntry, LemmaEntry } from "@/shared/dictionary/types";

export const STATIC_DICTIONARY_DB_NAME = "word-buddy";

export class StaticDictionaryDatabase extends Dexie {
	dict!: EntityTable<DictionaryEntry, "word">;
	lemma!: EntityTable<LemmaEntry, "surface">;

	public constructor() {
		super(STATIC_DICTIONARY_DB_NAME);
		this.version(1).stores({
			dict: "word",
			lemma: "surface",
		});
		this.version(2).stores({
			lemma: "surface, lemma",
		});
	}
}

export const staticDictionaryDb = new StaticDictionaryDatabase();
