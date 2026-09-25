import Dexie, { type Table } from "dexie";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import type { TranslationCacheEntry } from "@/shared/translations/types";
import type { WordbookEntry } from "@/shared/wordbook/types";
import { deleteWordBuddyDatabase } from "@/test-helpers/indexedDb";

import {
	WORD_BUDDY_USER_DB_NAME,
	WordBuddyUserDatabase,
} from "../wordbook/database";
import { computeTranslationHash, sortWordsForHash } from "./hash";
import { createTranslationCacheService } from "./service";

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

class LegacyWordBuddyUserDatabase extends Dexie {
	words!: Table<WordbookEntry, string>;

	public constructor() {
		super(WORD_BUDDY_USER_DB_NAME);
		this.version(1).stores({
			words: "&lemma, addedAt",
		});
	}
}

const openDatabases = new Set<Dexie>();

function trackDatabase<TDatabase extends Dexie>(
	database: TDatabase,
): TDatabase {
	openDatabases.add(database);
	return database;
}

async function resetUserDatabase(): Promise<void> {
	for (const database of openDatabases) {
		database.close();
	}
	openDatabases.clear();
	await deleteWordBuddyDatabase();
}

function createCacheService(
	database: WordBuddyUserDatabase,
): ReturnType<typeof createTranslationCacheService> {
	return createTranslationCacheService({
		repository: {
			clearAll: async (): Promise<void> => {
				await database.translations.clear();
			},
			count: async (): Promise<number> => await database.translations.count(),
			getByHash: async (
				hash: string,
			): Promise<TranslationCacheEntry | undefined> =>
				await database.translations.get(hash),
			putEntry: async (entry: TranslationCacheEntry): Promise<string> =>
				await database.translations.put(entry),
		},
	});
}

afterEach(async () => {
	await resetUserDatabase();
});

afterAll(async () => {
	await resetUserDatabase();
});

describe("translation hash helpers", () => {
	it("sorts words deterministically and computes stable hashes", async () => {
		expect(sortWordsForHash(["cat", "apple", "bird"])).toEqual([
			"apple",
			"bird",
			"cat",
		]);

		const firstHash = await computeTranslationHash(
			"model-a",
			"What is on the agenda today?",
			["agenda", "today"],
		);
		const secondHash = await computeTranslationHash(
			"model-a",
			"What is on the agenda today?",
			["agenda", "today"],
		);
		const reorderedHash = await computeTranslationHash(
			"model-a",
			"What is on the agenda today?",
			["today", "agenda"],
		);
		const changedModelHash = await computeTranslationHash(
			"model-b",
			"What is on the agenda today?",
			["agenda", "today"],
		);

		expect(firstHash).toBe(secondHash);
		expect(firstHash).toBe(reorderedHash);
		expect(firstHash).not.toBe(changedModelHash);
		expect(firstHash).toMatch(/^[0-9a-f]{64}$/u);
	});
});

describe("createTranslationCacheService", () => {
	it("creates a fresh v2 schema and round-trips cached translations", async () => {
		await resetUserDatabase();
		const database = trackDatabase(new WordBuddyUserDatabase());
		await database.open();

		expect(database.tables.map((table) => table.name).sort()).toEqual([
			"translations",
			"words",
		]);

		const cacheService = createCacheService(database);
		await expect(cacheService.get("missing-hash")).resolves.toBeNull();

		await cacheService.set(TEST_TRANSLATION_ENTRY);
		await expect(
			cacheService.get(TEST_TRANSLATION_ENTRY.hash),
		).resolves.toEqual(TEST_TRANSLATION_ENTRY);

		database.close();
		const reopenedDatabase = trackDatabase(new WordBuddyUserDatabase());
		await reopenedDatabase.open();
		await expect(
			reopenedDatabase.translations.get(TEST_TRANSLATION_ENTRY.hash),
		).resolves.toEqual(TEST_TRANSLATION_ENTRY);
	});

	it("upgrades a legacy v1 words database without losing existing data", async () => {
		await resetUserDatabase();
		const legacyDatabase = trackDatabase(new LegacyWordBuddyUserDatabase());
		await legacyDatabase.open();
		await legacyDatabase.words.put(TEST_WORD_ENTRY);
		legacyDatabase.close();

		const upgradedDatabase = trackDatabase(new WordBuddyUserDatabase());
		await upgradedDatabase.open();

		await expect(
			upgradedDatabase.words.get(TEST_WORD_ENTRY.lemma),
		).resolves.toEqual(TEST_WORD_ENTRY);

		await upgradedDatabase.translations.put(TEST_TRANSLATION_ENTRY);
		await expect(
			upgradedDatabase.translations.get(TEST_TRANSLATION_ENTRY.hash),
		).resolves.toEqual(TEST_TRANSLATION_ENTRY);
		await expect(
			upgradedDatabase.words.get(TEST_WORD_ENTRY.lemma),
		).resolves.toEqual(TEST_WORD_ENTRY);
	});
});
