import Dexie, { type Table } from "dexie";

import type { TranslationCacheEntry } from "@/shared/translations/types";
import type { WordbookEntry } from "@/shared/wordbook/types";

export const WORD_BUDDY_USER_DB_NAME = "wordBuddyUserDb";
export const WORD_BUDDY_USER_DB_SCHEMA_VERSION = 2;

export class WordBuddyUserDatabase extends Dexie {
	translations!: Table<TranslationCacheEntry, string>;
	words!: Table<WordbookEntry, string>;

	public constructor() {
		super(WORD_BUDDY_USER_DB_NAME);
		this.version(1).stores({
			words: "&lemma, addedAt",
		});
		this.version(2).stores({
			translations: "&hash, createdAt",
		});
	}
}

export const userDb = new WordBuddyUserDatabase();
