import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { TranslationCacheEntry } from "@/shared/translations/types";
import { deleteWordBuddyDatabase } from "@/test-helpers/indexedDb";

import { WordBuddyUserDatabase } from "../wordbook/database";
import { createTranslationRepository } from "./browserAdapters";
import {
	createTranslationCacheService,
	type TranslationCacheService,
} from "./service";

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

describe("createTranslationCacheService", () => {
	let database: WordBuddyUserDatabase;
	let cacheService: TranslationCacheService;

	beforeEach(() => {
		database = new WordBuddyUserDatabase();
		cacheService = createTranslationCacheService({
			repository: createTranslationRepository(database),
		});
	});

	afterEach(async () => {
		database.close();
		await deleteWordBuddyDatabase();
	});

	it("round-trips cached translations", async () => {
		await expect(cacheService.get("missing-hash")).resolves.toBeNull();

		await cacheService.set(TEST_TRANSLATION_ENTRY);

		await expect(
			cacheService.get(TEST_TRANSLATION_ENTRY.hash),
		).resolves.toEqual(TEST_TRANSLATION_ENTRY);
	});

	it("clears every cached translation and reports how many it removed", async () => {
		await cacheService.set(TEST_TRANSLATION_ENTRY);
		await cacheService.set({ ...TEST_TRANSLATION_ENTRY, hash: "hash-other" });

		await expect(cacheService.clear()).resolves.toBe(2);
		await expect(database.translations.count()).resolves.toBe(0);
	});
});
