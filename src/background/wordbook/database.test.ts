import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import type { TranslationCacheEntry } from "@/shared/translations/types";
import type { WordbookEntry } from "@/shared/wordbook/types";
import { deleteWordBuddyDatabase } from "@/test-helpers/indexedDb";

import { WORD_BUDDY_USER_DB_NAME, WordBuddyUserDatabase } from "./database";

const TEST_WORD_ENTRY: WordbookEntry = {
	addedAt: 1_700_000_000_000,
	context: "What is on the agenda today?",
	lemma: "agenda",
	original: "agenda",
	sourceUrl: "https://example.com/article",
};

const TEST_TRANSLATION_ENTRY: TranslationCacheEntry = {
	createdAt: 1_700_000_000_100,
	hash: "hash-agenda",
	model: "gpt-test",
	paragraph: "What is on the agenda today?",
	translations: {
		agenda: "议程",
	},
	words: ["agenda"],
};

afterEach(async () => {
	await deleteWordBuddyDatabase();
});

describe("WordBuddyUserDatabase", () => {
	it("creates a fresh v2 schema that persists across reopening", async () => {
		const database = new WordBuddyUserDatabase();
		try {
			await database.open();
			expect(database.tables.map((table) => table.name).sort()).toEqual([
				"translations",
				"words",
			]);
			await database.translations.put(TEST_TRANSLATION_ENTRY);
		} finally {
			database.close();
		}

		const reopenedDatabase = new WordBuddyUserDatabase();
		try {
			await expect(
				reopenedDatabase.translations.get(TEST_TRANSLATION_ENTRY.hash),
			).resolves.toEqual(TEST_TRANSLATION_ENTRY);
		} finally {
			reopenedDatabase.close();
		}
	});

	it("upgrades a legacy v1 words database without losing existing data", async () => {
		const versionOneDatabase = new Dexie(WORD_BUDDY_USER_DB_NAME);
		versionOneDatabase.version(1).stores({ words: "&lemma, addedAt" });
		await versionOneDatabase.table("words").put(TEST_WORD_ENTRY);
		versionOneDatabase.close();

		const database = new WordBuddyUserDatabase();
		try {
			await database.translations.put(TEST_TRANSLATION_ENTRY);
			await expect(database.words.get(TEST_WORD_ENTRY.lemma)).resolves.toEqual(
				TEST_WORD_ENTRY,
			);
			await expect(
				database.translations.get(TEST_TRANSLATION_ENTRY.hash),
			).resolves.toEqual(TEST_TRANSLATION_ENTRY);
		} finally {
			database.close();
		}
	});
});
